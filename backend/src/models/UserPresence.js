const { db } = require('../config/database');
const { redisClient } = require('../config/database');

// Redis keys for real-time presence
const PRESENCE_KEY = (userId) => `presence:${userId}`;
const VENUE_USERS_KEY = (venueId) => `venue:${venueId}:users`;
const GOING_OUT_KEY = 'going_out:users';

class UserPresence {
  /**
   * Set user as "going out" - broadcasting availability to selected groups/friends
   */
  static async setGoingOut(userId, { sharingMode = 'all_friends', sharingWith = [], expiresIn = null }) {
    // Calculate expiration (default 8 hours if not specified)
    const expiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000)
      : new Date(Date.now() + 8 * 60 * 60 * 1000);

    // Upsert presence record
    const query = `
      INSERT INTO user_presence (user_id, status, sharing_mode, sharing_with, expires_at)
      VALUES ($1, 'going_out', $2, $3, $4)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        status = 'going_out',
        venue_id = NULL,
        location = NULL,
        sharing_mode = $2,
        sharing_with = $3,
        expires_at = $4,
        started_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;

    // First ensure there's a unique constraint on user_id
    // This is handled by creating a partial unique index
    await db.none(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_presence_user_unique 
      ON user_presence (user_id) 
      WHERE status != 'offline'
    `).catch(() => {}); // Ignore if exists

    const result = await db.one(query, [
      userId,
      sharingMode,
      JSON.stringify(sharingWith),
      expiresAt,
    ]);

    // Update Redis for real-time queries
    await this.updateRedisPresence(userId, {
      status: 'going_out',
      sharingMode,
      sharingWith,
      expiresAt: expiresAt.toISOString(),
    });

    return result;
  }

  /**
   * Update user location and potentially detect venue arrival
   */
  static async updateLocation(userId, latitude, longitude, venueId = null) {
    const query = `
      UPDATE user_presence
      SET 
        location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
        venue_id = $4,
        status = CASE WHEN $4 IS NOT NULL THEN 'at_venue' ELSE status END,
        updated_at = NOW()
      WHERE user_id = $1
        AND (expires_at IS NULL OR expires_at > NOW())
      RETURNING 
        *,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
    `;

    const result = await db.oneOrNone(query, [userId, longitude, latitude, venueId]);

    if (result) {
      // Update Redis
      await this.updateRedisPresence(userId, {
        latitude,
        longitude,
        venueId,
        status: result.status,
      });

      // If at a venue, add to venue's user set
      if (venueId) {
        await redisClient.sAdd(VENUE_USERS_KEY(venueId), userId);
        await redisClient.expire(VENUE_USERS_KEY(venueId), 3600); // 1 hour TTL
      }
    }

    return result;
  }

  /**
   * Check user into a specific venue
   */
  static async checkInToVenue(userId, venueId, { sharingMode = 'all_friends', sharingWith = [], expiresIn = null }) {
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null; // No auto-expiry for venue check-ins unless specified

    const query = `
      INSERT INTO user_presence (user_id, venue_id, status, sharing_mode, sharing_with, expires_at)
      VALUES ($1, $2, 'at_venue', $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        venue_id = $2,
        status = 'at_venue',
        sharing_mode = $3,
        sharing_with = $4,
        expires_at = $5,
        started_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;

    const result = await db.one(query, [
      userId,
      venueId,
      sharingMode,
      JSON.stringify(sharingWith),
      expiresAt,
    ]);

    // Update Redis
    await this.updateRedisPresence(userId, {
      status: 'at_venue',
      venueId,
      sharingMode,
      sharingWith,
    });
    await redisClient.sAdd(VENUE_USERS_KEY(venueId), userId);

    return result;
  }

  /**
   * Stop sharing / go offline
   */
  static async stopSharing(userId) {
    const currentPresence = await this.getPresence(userId);
    
    const query = `
      UPDATE user_presence
      SET status = 'offline', updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await db.oneOrNone(query, [userId]);

    // Clean up Redis
    await redisClient.del(PRESENCE_KEY(userId));
    await redisClient.sRem(GOING_OUT_KEY, userId);
    
    if (currentPresence?.venue_id) {
      await redisClient.sRem(VENUE_USERS_KEY(currentPresence.venue_id), userId);
    }

    return result;
  }

  /**
   * Get current presence for a user
   */
  static async getPresence(userId) {
    // Try Redis first for speed
    const cached = await redisClient.get(PRESENCE_KEY(userId));
    if (cached) {
      return JSON.parse(cached);
    }

    // Fall back to database
    const query = `
      SELECT 
        up.*,
        ST_Y(up.location::geometry) as latitude,
        ST_X(up.location::geometry) as longitude,
        v.name as venue_name,
        v.category as venue_category
      FROM user_presence up
      LEFT JOIN venues v ON up.venue_id = v.id
      WHERE up.user_id = $1
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
        AND up.status != 'offline'
    `;

    return db.oneOrNone(query, [userId]);
  }

  /**
   * Get presence for multiple friends (batch query for radar view)
   */
  static async getFriendsPresence(userId, friendIds) {
    if (!friendIds || friendIds.length === 0) return [];

    const query = `
      SELECT 
        up.user_id,
        up.status,
        up.venue_id,
        ST_Y(up.location::geometry) as latitude,
        ST_X(up.location::geometry) as longitude,
        up.sharing_mode,
        up.sharing_with,
        up.started_at,
        u.display_name,
        u.avatar_url,
        v.name as venue_name,
        v.category as venue_category
      FROM user_presence up
      INNER JOIN users u ON up.user_id = u.id
      LEFT JOIN venues v ON up.venue_id = v.id
      WHERE up.user_id = ANY($1)
        AND up.status IN ('going_out', 'at_venue', 'sharing_location')
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
            AND $2::text = ANY(SELECT jsonb_array_elements_text(up.sharing_with))
          )
        )
    `;

    return db.manyOrNone(query, [friendIds, userId]);
  }

  /**
   * Get all users who are "going out" (for push notifications, etc.)
   */
  static async getGoingOutUsers() {
    const query = `
      SELECT 
        up.user_id,
        u.display_name,
        up.started_at
      FROM user_presence up
      INNER JOIN users u ON up.user_id = u.id
      WHERE up.status = 'going_out'
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
    `;
    return db.manyOrNone(query);
  }

  /**
   * Clean up expired presence records
   */
  static async cleanupExpired() {
    const query = `
      UPDATE user_presence
      SET status = 'offline'
      WHERE expires_at < NOW()
        AND status != 'offline'
      RETURNING user_id, venue_id
    `;

    const expired = await db.manyOrNone(query);

    // Clean up Redis for expired users
    for (const record of expired) {
      await redisClient.del(PRESENCE_KEY(record.user_id));
      await redisClient.sRem(GOING_OUT_KEY, record.user_id);
      if (record.venue_id) {
        await redisClient.sRem(VENUE_USERS_KEY(record.venue_id), record.user_id);
      }
    }

    return expired.length;
  }

  /**
   * Update ephemeral sharing duration
   */
  static async extendSharing(userId, additionalSeconds) {
    const query = `
      UPDATE user_presence
      SET expires_at = COALESCE(expires_at, NOW()) + INTERVAL '${additionalSeconds} seconds',
          updated_at = NOW()
      WHERE user_id = $1
        AND status != 'offline'
      RETURNING *
    `;
    return db.oneOrNone(query, [userId]);
  }

  /**
   * Helper: Update Redis presence cache
   */
  static async updateRedisPresence(userId, data) {
    const presence = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    
    await redisClient.set(
      PRESENCE_KEY(userId),
      JSON.stringify(presence),
      { EX: 3600 } // 1 hour TTL
    );

    if (data.status === 'going_out') {
      await redisClient.sAdd(GOING_OUT_KEY, userId);
    }
  }

  /**
   * Get count of users at a venue (for crowd estimation)
   */
  static async getVenueUserCount(venueId) {
    // Try Redis first
    const cachedCount = await redisClient.sCard(VENUE_USERS_KEY(venueId));
    if (cachedCount > 0) {
      return cachedCount;
    }

    // Fall back to database
    const result = await db.one(`
      SELECT COUNT(*) as count
      FROM user_presence
      WHERE venue_id = $1
        AND status = 'at_venue'
        AND (expires_at IS NULL OR expires_at > NOW())
    `, [venueId]);

    return parseInt(result.count);
  }
}

module.exports = UserPresence;
