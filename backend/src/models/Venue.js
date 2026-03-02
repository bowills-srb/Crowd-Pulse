const { db } = require('../config/database');

class Venue {
  /**
   * Create a new venue
   */
  static async create({
    externalPlaceId,
    name,
    address,
    city,
    state,
    zipCode,
    latitude,
    longitude,
    category,
    subcategory,
    estimatedCapacity,
    metadata = {},
  }) {
    const query = `
      INSERT INTO venues (
        external_place_id, name, address, city, state, zip_code,
        location, category, subcategory, estimated_capacity, metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
        $9, $10, $11, $12
      )
      RETURNING 
        *,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
    `;
    return db.one(query, [
      externalPlaceId,
      name,
      address,
      city,
      state,
      zipCode,
      longitude, // Note: PostGIS uses (lng, lat) order
      latitude,
      category,
      subcategory,
      estimatedCapacity,
      JSON.stringify(metadata),
    ]);
  }

  /**
   * Find venue by ID
   */
  static async findById(id) {
    const query = `
      SELECT 
        *,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
      FROM venues
      WHERE id = $1
    `;
    return db.oneOrNone(query, [id]);
  }

  /**
   * Find venue by external place ID (Google/Foursquare)
   */
  static async findByExternalId(externalPlaceId) {
    const query = `
      SELECT 
        *,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
      FROM venues
      WHERE external_place_id = $1
    `;
    return db.oneOrNone(query, [externalPlaceId]);
  }

  /**
   * Find venues within radius of a point
   * @param {number} latitude - Center latitude
   * @param {number} longitude - Center longitude
   * @param {number} radiusMeters - Search radius in meters
   * @param {object} options - Filter options
   */
  static async findNearby(latitude, longitude, radiusMeters = 5000, options = {}) {
    const {
      category,
      limit = 50,
      offset = 0,
      isActive = true,
    } = options;

    let whereClause = 'WHERE ST_DWithin(location, $1, $2)';
    const params = [
      `SRID=4326;POINT(${longitude} ${latitude})`,
      radiusMeters,
    ];
    let paramIndex = 3;

    if (isActive !== null) {
      whereClause += ` AND is_active = $${paramIndex}`;
      params.push(isActive);
      paramIndex++;
    }

    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    params.push(limit, offset);

    const query = `
      SELECT 
        *,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude,
        ST_Distance(location, $1) as distance_meters
      FROM venues
      ${whereClause}
      ORDER BY distance_meters
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    return db.manyOrNone(query, params);
  }

  /**
   * Find venues with current crowd data
   */
  static async findNearbyWithCrowdData(latitude, longitude, radiusMeters = 5000, options = {}) {
    const {
      category,
      vibePreference, // 'lively', 'lowkey', 'any'
      limit = 50,
    } = options;

    let whereClause = 'WHERE ST_DWithin(v.location, $1, $2) AND v.is_active = true';
    const params = [
      `SRID=4326;POINT(${longitude} ${latitude})`,
      radiusMeters,
    ];
    let paramIndex = 3;

    if (category) {
      whereClause += ` AND v.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Filter by vibe preference (crowd level)
    let vibeFilter = '';
    if (vibePreference === 'lively') {
      vibeFilter = 'AND COALESCE(cr.capacity_percentage, 0) >= 50';
    } else if (vibePreference === 'lowkey') {
      vibeFilter = 'AND COALESCE(cr.capacity_percentage, 100) < 50';
    }

    params.push(limit);

    const query = `
      WITH latest_readings AS (
        SELECT DISTINCT ON (venue_id)
          venue_id,
          estimated_count,
          capacity_percentage,
          trend,
          confidence,
          timestamp
        FROM crowd_readings
        WHERE timestamp > NOW() - INTERVAL '30 minutes'
        ORDER BY venue_id, timestamp DESC
      ),
      friend_counts AS (
        SELECT 
          venue_id,
          COUNT(*) as friends_here
        FROM user_presence
        WHERE venue_id IS NOT NULL
          AND status = 'at_venue'
          AND (expires_at IS NULL OR expires_at > NOW())
        GROUP BY venue_id
      )
      SELECT 
        v.*,
        ST_Y(v.location::geometry) as latitude,
        ST_X(v.location::geometry) as longitude,
        ST_Distance(v.location, $1) as distance_meters,
        cr.estimated_count,
        cr.capacity_percentage,
        cr.trend,
        cr.confidence,
        cr.timestamp as last_reading_at,
        COALESCE(fc.friends_here, 0) as friends_here
      FROM venues v
      LEFT JOIN latest_readings cr ON v.id = cr.venue_id
      LEFT JOIN friend_counts fc ON v.id = fc.venue_id
      ${whereClause}
      ${vibeFilter}
      ORDER BY ST_Distance(v.location, $1)
      LIMIT $${paramIndex}
    `;

    return db.manyOrNone(query, params);
  }

  /**
   * Update venue information
   */
  static async update(id, updates) {
    const allowedFields = [
      'name', 'address', 'city', 'state', 'zip_code',
      'category', 'subcategory', 'estimated_capacity',
      'metadata', 'is_verified', 'is_active',
    ];
    const setClauses = [];
    const values = [id];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbField)) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(dbField === 'metadata' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    // Handle location update separately
    if (updates.latitude && updates.longitude) {
      setClauses.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography`);
      values.push(updates.longitude, updates.latitude);
      paramIndex += 2;
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE venues 
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING 
        *,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
    `;
    return db.one(query, values);
  }

  /**
   * Search venues by name
   */
  static async search(searchQuery, options = {}) {
    const { city, category, limit = 20 } = options;
    
    let whereClause = 'WHERE name ILIKE $1 AND is_active = true';
    const params = [`%${searchQuery}%`];
    let paramIndex = 2;

    if (city) {
      whereClause += ` AND city ILIKE $${paramIndex}`;
      params.push(`%${city}%`);
      paramIndex++;
    }

    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    params.push(limit);

    const query = `
      SELECT 
        *,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
      FROM venues
      ${whereClause}
      ORDER BY name
      LIMIT $${paramIndex}
    `;

    return db.manyOrNone(query, params);
  }

  /**
   * Get venue categories (for filtering UI)
   */
  static async getCategories() {
    const query = `
      SELECT DISTINCT category, COUNT(*) as count
      FROM venues
      WHERE is_active = true
      GROUP BY category
      ORDER BY count DESC
    `;
    return db.manyOrNone(query);
  }

  /**
   * Get users currently at a venue
   */
  static async getUsersAtVenue(venueId, viewerId) {
    // Only return users who are sharing with the viewer
    const query = `
      SELECT 
        u.id,
        u.display_name,
        u.avatar_url,
        up.status,
        up.started_at
      FROM user_presence up
      INNER JOIN users u ON up.user_id = u.id
      WHERE up.venue_id = $1
        AND up.status = 'at_venue'
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
        AND (
          up.sharing_mode = 'all_friends'
          OR (
            up.sharing_mode = 'groups' 
            AND EXISTS (
              SELECT 1 FROM group_memberships gm1
              INNER JOIN group_memberships gm2 ON gm1.group_id = gm2.group_id
              WHERE gm1.user_id = up.user_id
                AND gm2.user_id = $2
                AND gm1.group_id = ANY(
                  SELECT jsonb_array_elements_text(up.sharing_with)::uuid
                )
            )
          )
          OR (
            up.sharing_mode = 'specific'
            AND $2::text = ANY(
              SELECT jsonb_array_elements_text(up.sharing_with)
            )
          )
        )
        AND EXISTS (
          SELECT 1 FROM friendships f
          WHERE (
            (f.requester_id = up.user_id AND f.addressee_id = $2)
            OR (f.addressee_id = up.user_id AND f.requester_id = $2)
          )
          AND f.status = 'accepted'
        )
    `;
    return db.manyOrNone(query, [venueId, viewerId]);
  }
}

module.exports = Venue;
