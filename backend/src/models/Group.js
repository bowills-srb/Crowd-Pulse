const { db } = require('../config/database');

class Group {
  /**
   * Create a new group
   */
  static async create(ownerId, { name, emoji = null, avatarUrl = null }) {
    return db.tx(async (t) => {
      // Create the group
      const group = await t.one(`
        INSERT INTO groups (name, owner_id, emoji, avatar_url)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [name, ownerId, emoji, avatarUrl]);

      // Add owner as a member with 'owner' role
      await t.none(`
        INSERT INTO group_memberships (group_id, user_id, role)
        VALUES ($1, $2, 'owner')
      `, [group.id, ownerId]);

      return group;
    });
  }

  /**
   * Find group by ID
   */
  static async findById(id) {
    return db.oneOrNone('SELECT * FROM groups WHERE id = $1', [id]);
  }

  /**
   * Get group with member count
   */
  static async findWithMemberCount(id) {
    const query = `
      SELECT 
        g.*,
        (SELECT COUNT(*) FROM group_memberships WHERE group_id = g.id) as member_count
      FROM groups g
      WHERE g.id = $1
    `;
    return db.oneOrNone(query, [id]);
  }

  /**
   * Get all groups for a user
   */
  static async getUserGroups(userId) {
    const query = `
      SELECT 
        g.*,
        gm.role,
        gm.joined_at,
        (SELECT COUNT(*) FROM group_memberships WHERE group_id = g.id) as member_count
      FROM groups g
      INNER JOIN group_memberships gm ON g.id = gm.group_id
      WHERE gm.user_id = $1
      ORDER BY g.name
    `;
    return db.manyOrNone(query, [userId]);
  }

  /**
   * Get group members
   */
  static async getMembers(groupId) {
    const query = `
      SELECT 
        u.id,
        u.display_name,
        u.avatar_url,
        u.last_active_at,
        gm.role,
        gm.joined_at
      FROM users u
      INNER JOIN group_memberships gm ON u.id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY 
        CASE gm.role 
          WHEN 'owner' THEN 1 
          WHEN 'admin' THEN 2 
          ELSE 3 
        END,
        u.display_name
    `;
    return db.manyOrNone(query, [groupId]);
  }

  /**
   * Get group member IDs only
   */
  static async getMemberIds(groupId) {
    const query = `
      SELECT user_id
      FROM group_memberships
      WHERE group_id = $1
    `;
    const results = await db.manyOrNone(query, [groupId]);
    return results.map(r => r.user_id);
  }

  /**
   * Add member to group
   */
  static async addMember(groupId, userId, addedByUserId) {
    // Check if adder has permission (owner or admin)
    const adderRole = await this.getMemberRole(groupId, addedByUserId);
    if (!adderRole || adderRole === 'member') {
      throw new Error('Only owners and admins can add members');
    }

    // Check if user is already a member
    const existingMember = await db.oneOrNone(
      'SELECT * FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (existingMember) {
      throw new Error('User is already a member of this group');
    }

    return db.one(`
      INSERT INTO group_memberships (group_id, user_id, role)
      VALUES ($1, $2, 'member')
      RETURNING *
    `, [groupId, userId]);
  }

  /**
   * Remove member from group
   */
  static async removeMember(groupId, userId, removedByUserId) {
    // Can't remove owner
    const targetRole = await this.getMemberRole(groupId, userId);
    if (targetRole === 'owner') {
      throw new Error('Cannot remove the group owner');
    }

    // Check if remover has permission
    const removerRole = await this.getMemberRole(groupId, removedByUserId);
    
    // User can remove themselves, or owner/admin can remove others
    const canRemove = userId === removedByUserId || 
      removerRole === 'owner' || 
      (removerRole === 'admin' && targetRole === 'member');

    if (!canRemove) {
      throw new Error('Insufficient permissions to remove this member');
    }

    return db.result(
      'DELETE FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
  }

  /**
   * Update member role
   */
  static async updateMemberRole(groupId, userId, newRole, updatedByUserId) {
    // Only owner can change roles
    const updaterRole = await this.getMemberRole(groupId, updatedByUserId);
    if (updaterRole !== 'owner') {
      throw new Error('Only the owner can change member roles');
    }

    // Can't change owner role
    const targetRole = await this.getMemberRole(groupId, userId);
    if (targetRole === 'owner') {
      throw new Error('Cannot change owner role');
    }

    if (!['admin', 'member'].includes(newRole)) {
      throw new Error('Invalid role');
    }

    return db.one(
      'UPDATE group_memberships SET role = $1 WHERE group_id = $2 AND user_id = $3 RETURNING *',
      [newRole, groupId, userId]
    );
  }

  /**
   * Get member role in group
   */
  static async getMemberRole(groupId, userId) {
    const result = await db.oneOrNone(
      'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    return result?.role || null;
  }

  /**
   * Check if user is member of group
   */
  static async isMember(groupId, userId) {
    const result = await db.one(
      'SELECT EXISTS(SELECT 1 FROM group_memberships WHERE group_id = $1 AND user_id = $2) as is_member',
      [groupId, userId]
    );
    return result.is_member;
  }

  /**
   * Update group details
   */
  static async update(groupId, userId, updates) {
    // Check permission
    const role = await this.getMemberRole(groupId, userId);
    if (!role || role === 'member') {
      throw new Error('Only owners and admins can update group details');
    }

    const allowedFields = ['name', 'emoji', 'avatar_url'];
    const setClauses = [];
    const values = [groupId];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbField)) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.findById(groupId);
    }

    const query = `
      UPDATE groups 
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    return db.one(query, values);
  }

  /**
   * Delete group
   */
  static async delete(groupId, userId) {
    // Only owner can delete
    const role = await this.getMemberRole(groupId, userId);
    if (role !== 'owner') {
      throw new Error('Only the owner can delete the group');
    }

    return db.result('DELETE FROM groups WHERE id = $1', [groupId]);
  }

  /**
   * Transfer ownership
   */
  static async transferOwnership(groupId, currentOwnerId, newOwnerId) {
    const currentRole = await this.getMemberRole(groupId, currentOwnerId);
    if (currentRole !== 'owner') {
      throw new Error('Only the owner can transfer ownership');
    }

    const newOwnerMember = await this.getMemberRole(groupId, newOwnerId);
    if (!newOwnerMember) {
      throw new Error('New owner must be a member of the group');
    }

    return db.tx(async (t) => {
      // Demote current owner to admin
      await t.none(
        'UPDATE group_memberships SET role = $1 WHERE group_id = $2 AND user_id = $3',
        ['admin', groupId, currentOwnerId]
      );

      // Promote new owner
      await t.none(
        'UPDATE group_memberships SET role = $1 WHERE group_id = $2 AND user_id = $3',
        ['owner', groupId, newOwnerId]
      );

      // Update groups table
      await t.none(
        'UPDATE groups SET owner_id = $1, updated_at = NOW() WHERE id = $2',
        [newOwnerId, groupId]
      );

      return this.findWithMemberCount(groupId);
    });
  }

  /**
   * Get members of group who are currently going out or at a venue
   */
  static async getActiveMembers(groupId) {
    const query = `
      SELECT 
        u.id,
        u.display_name,
        u.avatar_url,
        up.status,
        up.venue_id,
        v.name as venue_name
      FROM users u
      INNER JOIN group_memberships gm ON u.id = gm.user_id
      LEFT JOIN user_presence up ON u.id = up.user_id
      LEFT JOIN venues v ON up.venue_id = v.id
      WHERE gm.group_id = $1
        AND up.status IN ('going_out', 'at_venue')
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
    `;
    return db.manyOrNone(query, [groupId]);
  }
}

module.exports = Group;
