const express = require('express');
const Joi = require('joi');
const { VenuePing, Venue, Friendship, Group } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const createPingSchema = Joi.object({
  venueId: Joi.string().uuid().required(),
  targetType: Joi.string().valid('group', 'individual', 'all_friends').required(),
  targetId: Joi.string().uuid().when('targetType', {
    is: Joi.valid('group', 'individual'),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  message: Joi.string().max(280).optional(),
  expiresIn: Joi.number().min(1800).max(14400).default(14400), // 30min to 4hrs
});

const respondSchema = Joi.object({
  response: Joi.string().valid('in', 'out', 'maybe').required(),
});

/**
 * Create a venue ping (invitation)
 * POST /pings
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { error, value } = createPingSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Verify venue exists
    const venue = await Venue.findById(value.venueId);
    if (!venue) return res.status(404).json({ error: 'Venue not found' });

    // Verify target permissions
    if (value.targetType === 'individual') {
      const areFriends = await Friendship.areFriends(req.userId, value.targetId);
      if (!areFriends) return res.status(403).json({ error: 'Can only ping friends' });
    } else if (value.targetType === 'group') {
      const isMember = await Group.isMember(value.targetId, req.userId);
      if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });
    }

    const ping = await VenuePing.create({
      senderId: req.userId,
      venueId: value.venueId,
      targetType: value.targetType,
      targetId: value.targetId,
      message: value.message,
      expiresIn: value.expiresIn,
    });

    res.status(201).json({
      id: ping.id,
      venueId: ping.venue_id,
      venueName: venue.name,
      targetType: ping.target_type,
      message: ping.message,
      sentAt: ping.sent_at,
      expiresAt: ping.expires_at,
    });
  } catch (error) {
    console.error('Create ping error:', error);
    res.status(500).json({ error: 'Failed to create ping' });
  }
});

/**
 * Get received pings
 * GET /pings/received
 */
router.get('/received', authenticate, async (req, res) => {
  try {
    const pings = await VenuePing.getReceivedPings(req.userId);
    res.json({
      pings: pings.map(p => ({
        id: p.id,
        sender: {
          name: p.sender_name,
          avatar: p.sender_avatar,
        },
        venue: {
          id: p.venue_id,
          name: p.venue_name,
          address: p.venue_address,
          category: p.venue_category,
          location: {
            latitude: p.venue_latitude,
            longitude: p.venue_longitude,
          },
        },
        message: p.message,
        myResponse: p.my_response,
        sentAt: p.sent_at,
        expiresAt: p.expires_at,
      })),
    });
  } catch (error) {
    console.error('Get received pings error:', error);
    res.status(500).json({ error: 'Failed to get pings' });
  }
});

/**
 * Get sent pings
 * GET /pings/sent
 */
router.get('/sent', authenticate, async (req, res) => {
  try {
    const pings = await VenuePing.getSentPings(req.userId);
    res.json({
      pings: pings.map(p => ({
        id: p.id,
        venue: {
          id: p.venue_id,
          name: p.venue_name,
        },
        targetType: p.target_type,
        targetName: p.group_name || p.target_user_name || 'All Friends',
        message: p.message,
        responses: p.responses || [],
        sentAt: p.sent_at,
        expiresAt: p.expires_at,
      })),
    });
  } catch (error) {
    console.error('Get sent pings error:', error);
    res.status(500).json({ error: 'Failed to get sent pings' });
  }
});

/**
 * Get ping details
 * GET /pings/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const ping = await VenuePing.findById(req.params.id);
    if (!ping) return res.status(404).json({ error: 'Ping not found' });

    const responses = await VenuePing.getResponses(req.params.id);
    const counts = await VenuePing.getResponseCounts(req.params.id);

    res.json({
      id: ping.id,
      sender: {
        name: ping.sender_name,
        avatar: ping.sender_avatar,
      },
      venue: {
        id: ping.venue_id,
        name: ping.venue_name,
        address: ping.venue_address,
        location: {
          latitude: ping.venue_latitude,
          longitude: ping.venue_longitude,
        },
      },
      message: ping.message,
      sentAt: ping.sent_at,
      expiresAt: ping.expires_at,
      responses: responses.map(r => ({
        userId: r.user_id,
        displayName: r.display_name,
        avatar: r.avatar_url,
        response: r.response,
        respondedAt: r.responded_at,
      })),
      counts,
    });
  } catch (error) {
    console.error('Get ping error:', error);
    res.status(500).json({ error: 'Failed to get ping' });
  }
});

/**
 * Respond to a ping
 * POST /pings/:id/respond
 */
router.post('/:id/respond', authenticate, async (req, res) => {
  try {
    const { error, value } = respondSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const response = await VenuePing.respond(req.params.id, req.userId, value.response);
    const counts = await VenuePing.getResponseCounts(req.params.id);

    res.json({
      success: true,
      response: response.response,
      respondedAt: response.responded_at,
      counts,
    });
  } catch (error) {
    console.error('Respond to ping error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Delete a ping
 * DELETE /pings/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await VenuePing.delete(req.params.id, req.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete ping error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
