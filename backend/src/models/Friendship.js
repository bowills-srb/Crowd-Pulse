const { db } = require('../config/database');

class Friendship {
  /**
   * Send a friend request
   */
  static async sendRequest(requesterId, addresseeId) {
    // Check if friendship already exists
    const existing = await this.findBetweenUsers(requesterId, addresseeId);
    if (existing) {
      if (existing.status === 'blocked') {
        throw new Error('Cannot send friend request to this user');
      }
      if (existing.status === 'accepted') {
        throw new Error('Already friends with this user');
      }
      if (existing.status === 'pending') {
        // If they already sent us a request, accept it
        if (existing.addressee_id === requesterId) {
          return this.acceptRequest(existing.id, requesterId);
        }
        throw new Error('Friend request already sent');
      }
    }

    const query = `
      INSERT INTO friendships (requester_id, addressee_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING *
    `;
    return db.one(query, [requesterId, addresseeId]);
  }

  /**
   * Accept a friend request
   */
  static async acceptRequest(friendshipId, userId) {
    const query = `
      UPDATE friendships 
      SET status = 'accepted', accepted_at = NOW()
      WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
      RETURNING *
    `;
    const result = await db.oneOrNone(query, [friendshipId, userId]);
    if (!result) {
      throw new Error('Friend request not found or already processed');
    }
    return result;
  }

  /**
   * Decline/reject a friend request
   */
  static async declineRequest(friendshipId, userId) {
    return db.result(
      'DELETE FROM friendships WHERE id = $1 AND addressee_id = $2 AND status = $3',
      [friendshipId, userId, 'pending']
    );
  }

  /**
   * Remove a friend (unfriend)
   */
  static async removeFriend(friendshipId, userId) {
    // User can remove if they are either party
    return db.result(
      'DELETE FROM friendships WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2) AND status = $3',
      [friendshipId, userId, 'accepted']
    );
  }

  /**
   * Block a user
   */
  static async blockUser(userId, blockedUserId) {
    // First check for existing friendship
    const existing = await this.findBetweenUsers(userId, blockedUserId);
    
    if (existing) {
      return db.one(
        'UPDATE friendships SET status = $1, requester_id = $2, addressee_id = $3 WHERE id = $4 RETURNING *',
        ['blocked', userId, blockedUserId, existing.id]
      );
    }

    return db.one(
      'INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, $3) RETURNING *',
      [userId, blockedUserId, 'blocked']
    );
  }

  /**
   * Unblock a user
   */
  static async unblockUser(userId, blockedUserId) {
    return db.result(
      'DELETE FROM friendships WHERE requester_id = $1 AND addressee_id = $2 AND status = $3',
      [userId, blockedUserId, 'blocked']
    );
  }

  /**
   * Find friendship between two users
   */
  static async findBetweenUsers(userA, userB) {
    const query = `
      SELECT * FROM friendships
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)
    `;
    return db.oneOrNone(query, [userA, userB]);
  }

  /**
   * Get all friends for a user
   */
  static async getFriends(userId) {
    const query = `
      SELECT 
        u.id,
        u.display_name,
        u.avatar_url,
        u.last_active_at,
        f.id as friendship_id,
        f.accepted_at
      FROM users u
      INNER JOIN friendships f ON (
        (f.requester_id = $1 AND f.addressee_id = u.id)
        OR (f.addressee_id = $1 AND f.requester_id = u.id)
      )
      WHERE f.status = 'accepted'
      ORDER BY u.display_name
    `;
    return db.manyOrNone(query, [userId]);
  }

  /**
   * Get friend IDs only (for efficient queries)
   */
  static async getFriendIds(userId) {
    const query = `
      SELECT 
        CASE 
          WHEN f.requester_id = $1 THEN f.addressee_id
          ELSE f.requester_id
        END as friend_id
      FROM friendships f
      WHERE (f.requester_id = $1 OR f.addressee_id = $1)
        AND f.status = 'accepted'
    `;
    const results = await db.manyOrNone(query, [userId]);
    return results.map(r => r.friend_id);
  }

  /**
   * Get pending incoming friend requests
   */
  static async getPendingRequests(userId) {
    const query = `
      SELECT 
        f.id as friendship_id,
        f.created_at as requested_at,
        u.id,
        u.display_name,
        u.avatar_url
      FROM friendships f
      INNER JOIN users u ON f.requester_id = u.id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;
    return db.manyOrNone(query, [userId]);
  }

  /**
   * Get pending outgoing friend requests
   */
  static async getSentRequests(userId) {
    const query = `
      SELECT 
        f.id as friendship_id,
        f.created_at as requested_at,
        u.id,
        u.display_name,
        u.avatar_url
      FROM friendships f
      INNER JOIN users u ON f.addressee_id = u.id
      WHERE f.requester_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;
    return db.manyOrNone(query, [userId]);
  }

  /**
   * Get blocked users
   */
  static async getBlockedUsers(userId) {
    const query = `
      SELECT 
        u.id,
        u.display_name,
        u.avatar_url,
        f.id as friendship_id
      FROM friendships f
      INNER JOIN users u ON f.addressee_id = u.id
      WHERE f.requester_id = $1 AND f.status = 'blocked'
    `;
    return db.manyOrNone(query, [userId]);
  }

  /**
   * Check if users are friends
   */
  static async areFriends(userA, userB) {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM friendships
        WHERE (
          (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)
        )
        AND status = 'accepted'
      ) as are_friends
    `;
    const result = await db.one(query, [userA, userB]);
    return result.are_friends;
  }

  /**
   * Get mutual friends between two users
   */
  static async getMutualFriends(userA, userB) {
    const query = `
      WITH user_a_friends AS (
        SELECT 
          CASE 
            WHEN requester_id = $1 THEN addressee_id
            ELSE requester_id
          END as friend_id
        FROM friendships
        WHERE (requester_id = $1 OR addressee_id = $1)
          AND status = 'accepted'
      ),
      user_b_friends AS (
        SELECT 
          CASE 
            WHEN requester_id = $2 THEN addressee_id
            ELSE requester_id
          END as friend_id
        FROM friendships
        WHERE (requester_id = $2 OR addressee_id = $2)
          AND status = 'accepted'
      )
      SELECT u.id, u.display_name, u.avatar_url
      FROM users u
      WHERE u.id IN (
        SELECT friend_id FROM user_a_friends
        INTERSECT
        SELECT friend_id FROM user_b_friends
      )
    `;
    return db.manyOrNone(query, [userA, userB]);
  }
}

module.exports = Friendship;
