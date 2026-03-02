const express = require('express');
const Joi = require('joi');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const updateProfileSchema = Joi.object({
  displayName: Joi.string().min(2).max(50).optional(),
  avatarUrl: Joi.string().uri().optional(),
  ageRange: Joi.string().valid('18-20', '21-25', '26-30', '31-35', '36+').optional(),
  vibePreference: Joi.string().valid('lively', 'lowkey', 'any').optional(),
});

const updateSettingsSchema = Joi.object({
  notifications: Joi.boolean().optional(),
  defaultSharingMode: Joi.string().valid('all_friends', 'groups', 'specific', 'none').optional(),
  ghostMode: Joi.boolean().optional(),
});

/**
 * Get current user profile
 * GET /users/me
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findWithStats(req.userId);
    res.json({
      id: user.id,
      phone: user.phone,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      ageRange: user.age_range,
      vibePreference: user.vibe_preference,
      settings: user.settings,
      friendCount: parseInt(user.friend_count),
      groupCount: parseInt(user.group_count),
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * Update current user profile
 * PUT /users/me
 */
router.put('/me', authenticate, async (req, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await User.update(req.userId, value);
    res.json({
      id: user.id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      ageRange: user.age_range,
      vibePreference: user.vibe_preference,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Update user settings
 * PUT /users/me/settings
 */
router.put('/me/settings', authenticate, async (req, res) => {
  try {
    const { error, value } = updateSettingsSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const currentUser = await User.findById(req.userId);
    const newSettings = { ...currentUser.settings, ...value };
    
    const user = await User.update(req.userId, { settings: newSettings });
    res.json({ settings: user.settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * Get another user's public profile
 * GET /users/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Only return public info
    res.json({
      id: user.id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
