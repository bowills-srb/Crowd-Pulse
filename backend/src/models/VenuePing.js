const { db } = require('../config/database');

class VenuePing {
  /**
   * Create a venue ping (invitation)
   */
  static async create({
    senderId,
    venueId,
    targetType, // 'group', 'individual', 'all_friends'
    targetId = null,
    message = null,
    expiresIn = 4 * 60 * 60, // 4 hours default
  }) {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const query = `
      INSERT INTO venue_pings (sender_id, venue_id, target_type, target_id, message, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    return db.one(query, [senderId, venueId, targetType, targetId, message, expiresAt]);
  }

  /**
   * Get a ping by ID with venue and sender details
   */
  static async findById(id) {
    const query = `
      SELECT 
        vp.*,
        u.display_name as sender_name,
        u.avatar_url as sender_avatar,
        v.name as venue_name,
        v.address as venue_address,
        v.category as venue_category,
        ST_Y(v.location::geometry) as venue_latitude,
        ST_X(v.location::geometry) as venue_longitude
      FROM venue_pings vp
      INNER JOIN users u ON vp.sender_id = u.id
      INNER JOIN venues v ON vp.venue_id = v.id
      WHERE vp.id = $1
    `;
    return db.oneOrNone(query, [id]);
  }

  /**
   * Get pings received by a user
   */
  static async getReceivedPings(userId, includeExpired = false) {
    let expireFilter = includeExpired ? '' : 'AND (vp.expires_at IS NULL OR vp.expires_at > NOW())';

    const query = `
      SELECT 
        vp.*,
        u.display_name as sender_name,
        u.avatar_url as sender_avatar,
        v.name as venue_name,
        v.address as venue_address,
        v.category as venue_category,
        ST_Y(v.location::geometry) as venue_latitude,
        ST_X(v.location::geometry) as venue_longitude,
        pr.response as my_response,
        pr.responded_at as my_response_time
      FROM venue_pings vp
      INNER JOIN users u ON vp.sender_id = u.id
      INNER JOIN venues v ON vp.venue_id = v.id
      LEFT JOIN ping_responses pr ON vp.id = pr.ping_id AND pr.user_id = $1
      WHERE (
        (vp.target_type = 'individual' AND vp.target_id = $1)
        OR (vp.target_type = 'all_friends' AND EXISTS (
          SELECT 1 FROM friendships f
          WHERE (
            (f.requester_id = vp.sender_id AND f.addressee_id = $1)
            OR (f.addressee_id = vp.sender_id AND f.requester_id = $1)
          )
          AND f.status = 'accepted'
        ))
        OR (vp.target_type = 'group' AND EXISTS (
          SELECT 1 FROM group_memberships gm
          WHERE gm.group_id = vp.target_id AND gm.user_id = $1
        ))
      )
      ${expireFilter}
      ORDER BY vp.sent_at DESC
    `;

    return db.manyOrNone(query, [userId]);
  }

  /**
   * Get pings sent by a user
   */
  static async getSentPings(userId, includeExpired = false) {
    let expireFilter = includeExpired ? '' : 'AND (vp.expires_at IS NULL OR vp.expires_at > NOW())';

    const query = `
      SELECT 
        vp.*,
        v.name as venue_name,
        v.address as venue_address,
        v.category as venue_category,
        g.name as group_name,
        target_user.display_name as target_user_name,
        (
          SELECT json_agg(json_build_object(
            'userId', pr.user_id,
            'displayName', ru.display_name,
            'avatarUrl', ru.avatar_url,
            'response', pr.response,
            'respondedAt', pr.responded_at
          ))
          FROM ping_responses pr
          INNER JOIN users ru ON pr.user_id = ru.id
          WHERE pr.ping_id = vp.id
        ) as responses
      FROM venue_pings vp
      INNER JOIN venues v ON vp.venue_id = v.id
      LEFT JOIN groups g ON vp.target_type = 'group' AND vp.target_id = g.id
      LEFT JOIN users target_user ON vp.target_type = 'individual' AND vp.target_id = target_user.id
      WHERE vp.sender_id = $1
      ${expireFilter}
      ORDER BY vp.sent_at DESC
    `;

    return db.manyOrNone(query, [userId]);
  }

  /**
   * Respond to a ping
   */
  static async respond(pingId, userId, response) {
    if (!['in', 'out', 'maybe'].includes(response)) {
      throw new Error('Invalid response. Must be: in, out, or maybe');
    }

    // Check if ping exists and is valid
    const ping = await this.findById(pingId);
    if (!ping) {
      throw new Error('Ping not found');
    }
    if (ping.expires_at && new Date(ping.expires_at) < new Date()) {
      throw new Error('This ping has expired');
    }

    const query = `
      INSERT INTO ping_responses (ping_id, user_id, response)
      VALUES ($1, $2, $3)
      ON CONFLICT (ping_id, user_id)
      DO UPDATE SET response = $3, responded_at = NOW()
      RETURNING *
    `;

    return db.one(query, [pingId, userId, response]);
  }

  /**
   * Get responses for a ping
   */
  static async getResponses(pingId) {
    const query = `
      SELECT 
        pr.*,
        u.display_name,
        u.avatar_url
      FROM ping_responses pr
      INNER JOIN users u ON pr.user_id = u.id
      WHERE pr.ping_id = $1
      ORDER BY pr.responded_at DESC
    `;
    return db.manyOrNone(query, [pingId]);
  }

  /**
   * Get response counts for a ping
   */
  static async getResponseCounts(pingId) {
    const query = `
      SELECT 
        response,
        COUNT(*) as count
      FROM ping_responses
      WHERE ping_id = $1
      GROUP BY response
    `;
    const results = await db.manyOrNone(query, [pingId]);
    
    return {
      in: 0,
      out: 0,
      maybe: 0,
      ...Object.fromEntries(results.map(r => [r.response, parseInt(r.count)])),
    };
  }

  /**
   * Delete a ping (only sender can delete)
   */
  static async delete(pingId, userId) {
    const result = await db.result(
      'DELETE FROM venue_pings WHERE id = $1 AND sender_id = $2',
      [pingId, userId]
    );
    if (result.rowCount === 0) {
      throw new Error('Ping not found or you do not have permission to delete it');
    }
    return true;
  }

  /**
   * Get active pings for a venue (shows social activity)
   */
  static async getVenuePings(venueId, limit = 10) {
    const query = `
      SELECT 
        vp.*,
        u.display_name as sender_name,
        u.avatar_url as sender_avatar,
        (
          SELECT COUNT(*) FILTER (WHERE response = 'in')
          FROM ping_responses WHERE ping_id = vp.id
        ) as in_count
      FROM venue_pings vp
      INNER JOIN users u ON vp.sender_id = u.id
      WHERE vp.venue_id = $1
        AND (vp.expires_at IS NULL OR vp.expires_at > NOW())
      ORDER BY vp.sent_at DESC
      LIMIT $2
    `;
    return db.manyOrNone(query, [venueId, limit]);
  }

  /**
   * Cleanup expired pings
   */
  static async cleanupExpired() {
    const result = await db.result(`
      DELETE FROM venue_pings
      WHERE expires_at < NOW() - INTERVAL '24 hours'
    `);
    return result.rowCount;
  }
}

module.exports = VenuePing;
