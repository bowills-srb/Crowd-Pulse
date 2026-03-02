const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const { Friendship, UserPresence } = require('../models');
const { redisClient } = require('../config/database');

// Track connected users
const connectedUsers = new Map(); // userId -> Set of socketIds

/**
 * Initialize Socket.io with the HTTP server
 */
const initializeSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId} (socket: ${socket.id})`);

    // Track this connection
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);

    // Join personal room for direct messages
    socket.join(`user:${userId}`);

    // Get friend IDs and join their rooms to receive updates
    const friendIds = await Friendship.getFriendIds(userId);
    friendIds.forEach(friendId => {
      socket.join(`friend-updates:${friendId}`);
    });

    // Notify friends that user is online
    socket.to(`friend-updates:${userId}`).emit('friend:online', {
      userId,
      timestamp: new Date().toISOString(),
    });

    /**
     * Handle presence updates
     */
    socket.on('presence:update', async (data) => {
      try {
        const { status, venueId, latitude, longitude, sharingMode, sharingWith } = data;

        // Broadcast to appropriate friends based on sharing settings
        const updatePayload = {
          userId,
          status,
          venueId,
          location: latitude && longitude ? { latitude, longitude } : null,
          timestamp: new Date().toISOString(),
        };

        if (sharingMode === 'all_friends') {
          socket.to(`friend-updates:${userId}`).emit('presence:update', updatePayload);
        } else if (sharingMode === 'groups' && sharingWith?.length > 0) {
          // Emit to specific group rooms
          sharingWith.forEach(groupId => {
            io.to(`group:${groupId}`).emit('presence:update', updatePayload);
          });
        } else if (sharingMode === 'specific' && sharingWith?.length > 0) {
          // Emit to specific users
          sharingWith.forEach(targetUserId => {
            io.to(`user:${targetUserId}`).emit('presence:update', updatePayload);
          });
        }
      } catch (error) {
        console.error('Presence update error:', error);
        socket.emit('error', { message: 'Failed to update presence' });
      }
    });

    /**
     * Handle location pings (real-time location updates)
     */
    socket.on('location:ping', async (data) => {
      try {
        const { latitude, longitude, venueId } = data;

        // Update presence in database
        await UserPresence.updateLocation(userId, latitude, longitude, venueId);

        // Get current presence to check sharing settings
        const presence = await UserPresence.getPresence(userId);
        if (!presence || presence.sharing_mode === 'none') return;

        const updatePayload = {
          userId,
          location: { latitude, longitude },
          venueId,
          timestamp: new Date().toISOString(),
        };

        if (presence.sharing_mode === 'all_friends') {
          socket.to(`friend-updates:${userId}`).emit('location:update', updatePayload);
        }
        // Similar logic for groups/specific as above
      } catch (error) {
        console.error('Location ping error:', error);
      }
    });

    /**
     * Handle venue ping (invitation)
     */
    socket.on('ping:send', async (data) => {
      try {
        const { pingId, targetType, targetId, venue } = data;

        const pingPayload = {
          pingId,
          senderId: userId,
          venue,
          timestamp: new Date().toISOString(),
        };

        if (targetType === 'all_friends') {
          socket.to(`friend-updates:${userId}`).emit('ping:received', pingPayload);
        } else if (targetType === 'group') {
          io.to(`group:${targetId}`).emit('ping:received', pingPayload);
        } else if (targetType === 'individual') {
          io.to(`user:${targetId}`).emit('ping:received', pingPayload);
        }
      } catch (error) {
        console.error('Send ping error:', error);
      }
    });

    /**
     * Handle ping response
     */
    socket.on('ping:respond', async (data) => {
      try {
        const { pingId, senderId, response } = data;

        io.to(`user:${senderId}`).emit('ping:response', {
          pingId,
          responderId: userId,
          response,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Ping response error:', error);
      }
    });

    /**
     * Join a group room
     */
    socket.on('group:join', (groupId) => {
      socket.join(`group:${groupId}`);
    });

    /**
     * Leave a group room
     */
    socket.on('group:leave', (groupId) => {
      socket.leave(`group:${groupId}`);
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId} (socket: ${socket.id})`);

      // Remove from connected users
      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);

          // Notify friends that user is offline (only if no other connections)
          socket.to(`friend-updates:${userId}`).emit('friend:offline', {
            userId,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });
  });

  return io;
};

/**
 * Emit event to a specific user (from external code)
 */
const emitToUser = (io, userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emit event to all friends of a user
 */
const emitToFriends = (io, userId, event, data) => {
  io.to(`friend-updates:${userId}`).emit(event, data);
};

/**
 * Check if user is connected
 */
const isUserConnected = (userId) => {
  return connectedUsers.has(userId) && connectedUsers.get(userId).size > 0;
};

/**
 * Get count of connected users
 */
const getConnectedUserCount = () => {
  return connectedUsers.size;
};

module.exports = {
  initializeSocket,
  emitToUser,
  emitToFriends,
  isUserConnected,
  getConnectedUserCount,
};
