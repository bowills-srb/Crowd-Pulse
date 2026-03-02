const express = require('express');
const Joi = require('joi');
const { Group } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const createGroupSchema = Joi.object({
  name: Joi.string().min(1).max(50).required(),
  emoji: Joi.string().max(10).optional(),
});

router.get('/', authenticate, async (req, res) => {
  try {
    const groups = await Group.getUserGroups(req.userId);
    res.json({
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        role: g.role,
        memberCount: parseInt(g.member_count),
      })),
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { error, value } = createGroupSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const group = await Group.create(req.userId, value);
    res.status(201).json({ id: group.id, name: group.name, emoji: group.emoji });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const isMember = await Group.isMember(req.params.id, req.userId);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

    const group = await Group.findWithMemberCount(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const members = await Group.getMembers(req.params.id);
    const myRole = await Group.getMemberRole(req.params.id, req.userId);

    res.json({
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      myRole,
      members: members.map(m => ({
        id: m.id,
        displayName: m.display_name,
        avatarUrl: m.avatar_url,
        role: m.role,
      })),
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to get group' });
  }
});

router.post('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    await Group.addMember(req.params.id, req.params.userId, req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    await Group.removeMember(req.params.id, req.params.userId, req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/active', authenticate, async (req, res) => {
  try {
    const isMember = await Group.isMember(req.params.id, req.userId);
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    const activeMembers = await Group.getActiveMembers(req.params.id);
    res.json({
      members: activeMembers.map(m => ({
        id: m.id,
        displayName: m.display_name,
        status: m.status,
        venueName: m.venue_name,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get active members' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Group.delete(req.params.id, req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
