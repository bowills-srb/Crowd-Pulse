const express = require('express');
const Joi = require('joi');
const { UserPresence, Friendship } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const goingOutSchema = Joi.object({
  sharingMode: Joi.string().valid('all_friends', 'groups', 'specific', 'none').default('all_friends'),
  sharingWith: Joi.array().items(Joi.string().uuid()).default([]),
  expiresIn: Joi.number().min(1800).max(43200).optional(),
});

const checkInSchema = Joi.object({
  venueId: Joi.string().uuid().required(),
  sharingMode: Joi.string().valid('all_friends', 'groups', 'specific', 'none').default('all_friends'),
  sharingWith: Joi.array().items(Joi.string().uuid()).default([]),
  expiresIn: Joi.number().min(1800).max(43200).optional(),
});

const locationUpdateSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  venueId: Joi.string().uuid().optional(),
});

router.post('/going-out', authenticate, async (req, res) => {
  try {
    const { error, value } = goingOutSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const presence = await UserPresence.setGoingOut(req.userId, value);
    res.json({ success: true, status: 'going_out', ...presence });
  } catch (error) {
    console.error('Going out error:', error);
    res.status(500).json({ error: 'Failed to set going out status' });
  }
});

router.post('/check-in', authenticate, async (req, res) => {
  try {
    const { error, value } = checkInSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const presence = await UserPresence.checkInToVenue(req.userId, value.venueId, value);
    res.json({ success: true, status: 'at_venue', ...presence });
  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

router.put('/location', authenticate, async (req, res) => {
  try {
    const { error, value } = locationUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const presence = await UserPresence.updateLocation(req.userId, value.latitude, value.longitude, value.venueId);
    if (!presence) return res.status(400).json({ error: 'No active sharing session' });
    res.json({ success: true, ...presence });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

router.post('/stop', authenticate, async (req, res) => {
  try {
    await UserPresence.stopSharing(req.userId);
    res.json({ success: true, status: 'offline' });
  } catch (error) {
    console.error('Stop sharing error:', error);
    res.status(500).json({ error: 'Failed to stop sharing' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const presence = await UserPresence.getPresence(req.userId);
    if (!presence) return res.json({ status: 'offline', sharing: false });
    res.json({ status: presence.status, sharing: true, ...presence });
  } catch (error) {
    console.error('Get presence error:', error);
    res.status(500).json({ error: 'Failed to get presence status' });
  }
});

router.get('/friends', authenticate, async (req, res) => {
  try {
    const friendIds = await Friendship.getFriendIds(req.userId);
    if (friendIds.length === 0) return res.json({ friends: [] });

    const friendsPresence = await UserPresence.getFriendsPresence(req.userId, friendIds);
    res.json({
      friends: friendsPresence.map(f => ({
        id: f.user_id,
        displayName: f.display_name,
        avatarUrl: f.avatar_url,
        status: f.status,
        venueId: f.venue_id,
        venueName: f.venue_name,
        location: f.latitude ? { latitude: f.latitude, longitude: f.longitude } : null,
      })),
    });
  } catch (error) {
    console.error('Get friends presence error:', error);
    res.status(500).json({ error: 'Failed to get friends presence' });
  }
});

module.exports = router;
