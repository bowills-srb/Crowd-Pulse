const express = require('express');
const Joi = require('joi');
const { Friendship, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { sendFriendInvite, formatPhoneE164 } = require('../services/twilioService');

const router = express.Router();

/**
 * Get all friends
 * GET /friends
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const friends = await Friendship.getFriends(req.userId);
    res.json({
      friends: friends.map(f => ({
        id: f.id,
        displayName: f.display_name,
        avatarUrl: f.avatar_url,
        friendshipId: f.friendship_id,
        friendsSince: f.accepted_at,
        lastActive: f.last_active_at,
      })),
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

/**
 * Invite a non-user via SMS
 * POST /friends/invite
 */
router.post('/invite', authenticate, async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const formattedPhone = formatPhoneE164(phone);
    
    // Check if user already exists
    const existingUser = await User.findByPhone(formattedPhone);
    if (existingUser) {
      return res.status(400).json({ 
        error: 'User already on CrowdPulse',
        userId: existingUser.id,
        message: 'Send them a friend request instead',
      });
    }

    // Get sender's name
    const sender = await User.findById(req.userId);
    
    // Send SMS invite
    await sendFriendInvite(formattedPhone, sender.display_name);

    res.json({
      success: true,
      message: 'Invite sent!',
    });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: error.message || 'Failed to send invite' });
  }
});

/**
 * Search users to add as friends
 * GET /friends/search
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const users = await User.search(q, req.userId);
    
    // Check friendship status for each user
    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        const friendship = await Friendship.findBetweenUsers(req.userId, user.id);
        return {
          id: user.id,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          friendshipStatus: friendship?.status || null,
          friendshipId: friendship?.id || null,
        };
      })
    );

    res.json({ users: usersWithStatus });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

/**
 * Get pending friend requests (incoming)
 * GET /friends/requests
 */
router.get('/requests', authenticate, async (req, res) => {
  try {
    const requests = await Friendship.getPendingRequests(req.userId);
    res.json({
      requests: requests.map(r => ({
        friendshipId: r.friendship_id,
        id: r.id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        requestedAt: r.requested_at,
      })),
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to get friend requests' });
  }
});

/**
 * Get sent friend requests (outgoing)
 * GET /friends/requests/sent
 */
router.get('/requests/sent', authenticate, async (req, res) => {
  try {
    const requests = await Friendship.getSentRequests(req.userId);
    res.json({
      requests: requests.map(r => ({
        friendshipId: r.friendship_id,
        id: r.id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        requestedAt: r.requested_at,
      })),
    });
  } catch (error) {
    console.error('Get sent requests error:', error);
    res.status(500).json({ error: 'Failed to get sent requests' });
  }
});

/**
 * Send friend request
 * POST /friends/request/:userId
 */
router.post('/request/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const friendship = await Friendship.sendRequest(req.userId, userId);
    res.json({
      success: true,
      friendshipId: friendship.id,
      status: friendship.status,
    });
  } catch (error) {
    console.error('Send request error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Accept friend request
 * POST /friends/accept/:friendshipId
 */
router.post('/accept/:friendshipId', authenticate, async (req, res) => {
  try {
    const friendship = await Friendship.acceptRequest(req.params.friendshipId, req.userId);
    res.json({
      success: true,
      friendshipId: friendship.id,
      status: 'accepted',
    });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Decline friend request
 * POST /friends/decline/:friendshipId
 */
router.post('/decline/:friendshipId', authenticate, async (req, res) => {
  try {
    await Friendship.declineRequest(req.params.friendshipId, req.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Decline request error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Remove friend
 * DELETE /friends/:friendshipId
 */
router.delete('/:friendshipId', authenticate, async (req, res) => {
  try {
    await Friendship.removeFriend(req.params.friendshipId, req.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Block user
 * POST /friends/block/:userId
 */
router.post('/block/:userId', authenticate, async (req, res) => {
  try {
    await Friendship.blockUser(req.userId, req.params.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get mutual friends with another user
 * GET /friends/mutual/:userId
 */
router.get('/mutual/:userId', authenticate, async (req, res) => {
  try {
    const mutualFriends = await Friendship.getMutualFriends(req.userId, req.params.userId);
    res.json({
      mutualFriends: mutualFriends.map(f => ({
        id: f.id,
        displayName: f.display_name,
        avatarUrl: f.avatar_url,
      })),
    });
  } catch (error) {
    console.error('Get mutual friends error:', error);
    res.status(500).json({ error: 'Failed to get mutual friends' });
  }
});

module.exports = router;
