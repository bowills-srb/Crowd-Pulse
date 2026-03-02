const { db } = require('../config/database');

class CrowdReading {
  /**
   * Record a new crowd reading
   */
  static async create({
    venueId,
    estimatedCount,
    capacityPercentage,
    source = 'user_pings',
    confidence = 'medium',
    trend = null,
  }) {
    const query = `
      INSERT INTO crowd_readings (venue_id, estimated_count, capacity_percentage, source, confidence, trend)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    return db.one(query, [
      venueId,
      estimatedCount,
      capacityPercentage,
      source,
      confidence,
      trend,
    ]);
  }

  /**
   * Get latest reading for a venue
   */
  static async getLatest(venueId) {
    const query = `
      SELECT *
      FROM crowd_readings
      WHERE venue_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    return db.oneOrNone(query, [venueId]);
  }

  /**
   * Get readings for a venue within a time window
   */
  static async getRecent(venueId, minutes = 30) {
    const query = `
      SELECT *
      FROM crowd_readings
      WHERE venue_id = $1
        AND timestamp > NOW() - INTERVAL '${minutes} minutes'
      ORDER BY timestamp DESC
    `;
    return db.manyOrNone(query, [venueId]);
  }

  /**
   * Calculate crowd reading from user presence data
   */
  static async calculateFromPresence(venueId) {
    // Count users currently at the venue
    const countResult = await db.one(`
      SELECT COUNT(*) as user_count
      FROM user_presence
      WHERE venue_id = $1
        AND status = 'at_venue'
        AND (expires_at IS NULL OR expires_at > NOW())
    `, [venueId]);

    const userCount = parseInt(countResult.user_count);

    // Get venue capacity
    const venue = await db.oneOrNone(
      'SELECT estimated_capacity FROM venues WHERE id = $1',
      [venueId]
    );

    if (!venue) return null;

    // Estimate total crowd (assume app users are ~10-20% of actual crowd)
    // This multiplier should be tuned based on actual data
    const estimatedMultiplier = 8;
    const estimatedCount = userCount * estimatedMultiplier;
    
    const capacityPercentage = venue.estimated_capacity 
      ? Math.min(100, (estimatedCount / venue.estimated_capacity) * 100)
      : null;

    // Determine trend by comparing to previous reading
    const previousReading = await this.getLatest(venueId);
    let trend = 'steady';
    if (previousReading) {
      const diff = estimatedCount - previousReading.estimated_count;
      if (diff > 5) trend = 'filling_up';
      else if (diff < -5) trend = 'emptying';
    }

    // Determine confidence based on user count
    let confidence = 'low';
    if (userCount >= 10) confidence = 'high';
    else if (userCount >= 5) confidence = 'medium';

    return this.create({
      venueId,
      estimatedCount,
      capacityPercentage,
      source: 'user_pings',
      confidence,
      trend,
    });
  }

  /**
   * Get average crowd levels by hour for a venue (for predictions)
   */
  static async getHistoricalAverages(venueId, dayOfWeek = null) {
    let dayFilter = '';
    const params = [venueId];

    if (dayOfWeek !== null) {
      dayFilter = 'AND EXTRACT(DOW FROM timestamp) = $2';
      params.push(dayOfWeek);
    }

    const query = `
      SELECT 
        EXTRACT(HOUR FROM timestamp) as hour,
        AVG(capacity_percentage) as avg_capacity,
        AVG(estimated_count) as avg_count,
        COUNT(*) as sample_count
      FROM crowd_readings
      WHERE venue_id = $1
        ${dayFilter}
        AND timestamp > NOW() - INTERVAL '30 days'
      GROUP BY EXTRACT(HOUR FROM timestamp)
      ORDER BY hour
    `;

    return db.manyOrNone(query, params);
  }

  /**
   * Get predicted crowd level for a venue at a specific time
   */
  static async getPrediction(venueId, targetHour, dayOfWeek) {
    const query = `
      SELECT 
        AVG(capacity_percentage) as predicted_capacity,
        AVG(estimated_count) as predicted_count,
        COUNT(*) as sample_count
      FROM crowd_readings
      WHERE venue_id = $1
        AND EXTRACT(HOUR FROM timestamp) = $2
        AND EXTRACT(DOW FROM timestamp) = $3
        AND timestamp > NOW() - INTERVAL '60 days'
    `;

    return db.oneOrNone(query, [venueId, targetHour, dayOfWeek]);
  }

  /**
   * Get trending venues (rapidly filling up)
   */
  static async getTrendingVenues(latitude, longitude, radiusMeters = 5000, limit = 10) {
    const query = `
      WITH recent_readings AS (
        SELECT 
          venue_id,
          capacity_percentage,
          estimated_count,
          trend,
          timestamp,
          ROW_NUMBER() OVER (PARTITION BY venue_id ORDER BY timestamp DESC) as rn
        FROM crowd_readings
        WHERE timestamp > NOW() - INTERVAL '30 minutes'
      ),
      latest AS (
        SELECT * FROM recent_readings WHERE rn = 1
      )
      SELECT 
        v.*,
        ST_Y(v.location::geometry) as latitude,
        ST_X(v.location::geometry) as longitude,
        ST_Distance(v.location, $1) as distance_meters,
        l.capacity_percentage,
        l.estimated_count,
        l.trend,
        l.timestamp as last_reading_at
      FROM venues v
      INNER JOIN latest l ON v.id = l.venue_id
      WHERE ST_DWithin(v.location, $1, $2)
        AND v.is_active = true
        AND l.trend = 'filling_up'
      ORDER BY l.capacity_percentage DESC
      LIMIT $3
    `;

    return db.manyOrNone(query, [
      `SRID=4326;POINT(${longitude} ${latitude})`,
      radiusMeters,
      limit,
    ]);
  }

  /**
   * Get quiet venues (good for lowkey vibe)
   */
  static async getQuietVenues(latitude, longitude, radiusMeters = 5000, limit = 10) {
    const query = `
      WITH recent_readings AS (
        SELECT 
          venue_id,
          capacity_percentage,
          estimated_count,
          trend,
          timestamp,
          ROW_NUMBER() OVER (PARTITION BY venue_id ORDER BY timestamp DESC) as rn
        FROM crowd_readings
        WHERE timestamp > NOW() - INTERVAL '30 minutes'
      ),
      latest AS (
        SELECT * FROM recent_readings WHERE rn = 1
      )
      SELECT 
        v.*,
        ST_Y(v.location::geometry) as latitude,
        ST_X(v.location::geometry) as longitude,
        ST_Distance(v.location, $1) as distance_meters,
        COALESCE(l.capacity_percentage, 0) as capacity_percentage,
        COALESCE(l.estimated_count, 0) as estimated_count,
        l.trend,
        l.timestamp as last_reading_at
      FROM venues v
      LEFT JOIN latest l ON v.id = l.venue_id
      WHERE ST_DWithin(v.location, $1, $2)
        AND v.is_active = true
        AND COALESCE(l.capacity_percentage, 0) < 40
      ORDER BY COALESCE(l.capacity_percentage, 0) ASC
      LIMIT $3
    `;

    return db.manyOrNone(query, [
      `SRID=4326;POINT(${longitude} ${latitude})`,
      radiusMeters,
      limit,
    ]);
  }

  /**
   * Cleanup old readings (keep last 90 days of detailed data)
   */
  static async cleanup(daysToKeep = 90) {
    // First, aggregate old data into daily summaries (could be a separate table)
    // Then delete detailed records
    const result = await db.result(`
      DELETE FROM crowd_readings
      WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
    `);
    return result.rowCount;
  }
}

module.exports = CrowdReading;
