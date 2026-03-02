const { db } = require('../config/database');

class User {
  /**
   * Create a new user
   */
  static async create({ phone, displayName, avatarUrl = null, ageRange = null }) {
    const query = `
      INSERT INTO users (phone, display_name, avatar_url, age_range)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    return db.one(query, [phone, displayName, avatarUrl, ageRange]);
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    return db.oneOrNone('SELECT * FROM users WHERE id = $1', [id]);
  }

  /**
   * Find user by phone number
   */
  static async findByPhone(phone) {
    return db.oneOrNone('SELECT * FROM users WHERE phone = $1', [phone]);
  }

  /**
   * Update user profile
   */
  static async update(id, updates) {
    const allowedFields = ['display_name', 'avatar_url', 'age_range', 'vibe_preference', 'settings'];
    const setClauses = [];
    const values = [id];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase(); // camelCase to snake_case
      if (allowedFields.includes(dbField)) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE users 
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    return db.one(query, values);
  }

  /**
   * Update last active timestamp
   */
  static async updateLastActive(id) {
    return db.none(
      'UPDATE users SET last_active_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  /**
   * Verify phone number
   */
  static async verifyPhone(id) {
    return db.one(
      'UPDATE users SET phone_verified = true, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
  }

  /**
   * Get user with their friend count and group count
   */
  static async findWithStats(id) {
    const query = `
      SELECT 
        u.*,
        (
          SELECT COUNT(*) 
          FROM friendships f 
          WHERE (f.requester_id = u.id OR f.addressee_id = u.id) 
            AND f.status = 'accepted'
        ) as friend_count,
        (
          SELECT COUNT(*) 
          FROM group_memberships gm 
          WHERE gm.user_id = u.id
        ) as group_count
      FROM users u
      WHERE u.id = $1
    `;
    return db.oneOrNone(query, [id]);
  }

  /**
   * Search users by display name or phone (for adding friends)
   */
  static async search(query, excludeUserId, limit = 20) {
    const searchQuery = `
      SELECT id, display_name, avatar_url
      FROM users
      WHERE id != $1
        AND (
          display_name ILIKE $2
          OR phone LIKE $3
        )
      LIMIT $4
    `;
    return db.manyOrNone(searchQuery, [
      excludeUserId,
      `%${query}%`,
      `%${query}%`,
      limit,
    ]);
  }

  /**
   * Get users who are currently "going out" from a list of user IDs
   */
  static async getGoingOutFriends(userIds) {
    if (!userIds || userIds.length === 0) return [];

    const query = `
      SELECT 
        u.id, 
        u.display_name, 
        u.avatar_url,
        up.status,
        up.venue_id,
        v.name as venue_name
      FROM users u
      INNER JOIN user_presence up ON u.id = up.user_id
      LEFT JOIN venues v ON up.venue_id = v.id
      WHERE u.id = ANY($1)
        AND up.status IN ('going_out', 'at_venue')
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
    `;
    return db.manyOrNone(query, [userIds]);
  }
}

module.exports = User;
