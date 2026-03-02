/**
 * Push Notification Service
 * Firebase Cloud Messaging for iOS and Android
 */

let admin = null;
try {
  admin = require('firebase-admin');
} catch (error) {
  admin = null;
}
const { db } = require('../config/database');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) return;

  if (!admin) {
    console.warn('firebase-admin not installed - push notifications disabled');
    return;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
    console.log('Firebase Admin initialized');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use default credentials from file
    admin.initializeApp();
    firebaseInitialized = true;
    console.log('Firebase Admin initialized with default credentials');
  } else {
    console.warn('Firebase not configured - push notifications disabled');
  }
};

// Initialize on module load
initializeFirebase();

/**
 * Register a device token for push notifications
 * @param {string} userId 
 * @param {string} token - FCM device token
 * @param {string} platform - 'ios' or 'android'
 */
const registerDevice = async (userId, token, platform) => {
  await db.none(`
    INSERT INTO device_tokens (user_id, token, platform, created_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (token) 
    DO UPDATE SET user_id = $1, platform = $3, updated_at = NOW()
  `, [userId, token, platform]);
};

/**
 * Unregister a device token
 * @param {string} token 
 */
const unregisterDevice = async (token) => {
  await db.none('DELETE FROM device_tokens WHERE token = $1', [token]);
};

/**
 * Get all device tokens for a user
 * @param {string} userId 
 */
const getUserTokens = async (userId) => {
  const result = await db.manyOrNone(
    'SELECT token, platform FROM device_tokens WHERE user_id = $1',
    [userId]
  );
  return result || [];
};

/**
 * Send push notification to a specific user
 * @param {string} userId 
 * @param {object} notification - { title, body, data }
 */
const sendToUser = async (userId, notification) => {
  if (!firebaseInitialized) {
    console.log('Push disabled - would send to user:', userId, notification.title);
    return { success: false, reason: 'Firebase not configured' };
  }

  const tokens = await getUserTokens(userId);
  if (tokens.length === 0) {
    return { success: false, reason: 'No registered devices' };
  }

  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data || {},
    tokens: tokens.map(t => t.token),
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    
    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx].token);
        }
      });
      
      for (const token of failedTokens) {
        await unregisterDevice(token);
      }
    }

    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('FCM send error:', error);
    return { success: false, reason: error.message };
  }
};

/**
 * Send push notification to multiple users
 * @param {string[]} userIds 
 * @param {object} notification 
 */
const sendToUsers = async (userIds, notification) => {
  const results = await Promise.all(
    userIds.map(userId => sendToUser(userId, notification))
  );
  return results;
};

/**
 * Notification Templates
 */
const templates = {
  // Friend started going out
  friendGoingOut: (friendName) => ({
    title: `${friendName} is going out! 🎉`,
    body: 'Tap to see where they\'re heading',
    data: { type: 'friend_going_out' },
  }),

  // Friend arrived at venue
  friendAtVenue: (friendName, venueName) => ({
    title: `${friendName} is at ${venueName}`,
    body: 'Your friend just checked in',
    data: { type: 'friend_at_venue' },
  }),

  // Received a venue ping
  pingReceived: (senderName, venueName) => ({
    title: `${senderName} wants to meet up! 📍`,
    body: `Join them at ${venueName}`,
    data: { type: 'ping_received' },
  }),

  // Someone responded to your ping
  pingResponse: (responderName, response, venueName) => ({
    title: response === 'in' 
      ? `${responderName} is in! ✅` 
      : `${responderName} responded`,
    body: response === 'in' 
      ? `They'll meet you at ${venueName}`
      : `Response: ${response}`,
    data: { type: 'ping_response' },
  }),

  // Friend request received
  friendRequest: (senderName) => ({
    title: 'New friend request',
    body: `${senderName} wants to connect`,
    data: { type: 'friend_request' },
  }),

  // Friend request accepted
  friendAccepted: (friendName) => ({
    title: `${friendName} accepted your request! 🤝`,
    body: 'You can now see each other on the radar',
    data: { type: 'friend_accepted' },
  }),

  // Weekly activity summary
  weeklySummary: (stats) => ({
    title: 'Your week on CrowdPulse 📊',
    body: `You discovered ${stats.newVenues} spots and met up ${stats.meetups} times`,
    data: { type: 'weekly_summary' },
  }),

  // Venue promotion
  venuePromo: (venueName, promoText) => ({
    title: `🔥 ${venueName}`,
    body: promoText,
    data: { type: 'venue_promo' },
  }),

  // Friends are gathering
  friendsGathering: (count, venueName) => ({
    title: `${count} friends at ${venueName}! 👥`,
    body: 'Your crew is forming - join them?',
    data: { type: 'friends_gathering' },
  }),
};

/**
 * High-level notification senders
 */
const notify = {
  friendGoingOut: async (userId, friendName) => {
    return sendToUser(userId, templates.friendGoingOut(friendName));
  },

  friendAtVenue: async (userId, friendName, venueName) => {
    return sendToUser(userId, templates.friendAtVenue(friendName, venueName));
  },

  pingReceived: async (userId, senderName, venueName, pingId) => {
    const notification = templates.pingReceived(senderName, venueName);
    notification.data.pingId = pingId;
    return sendToUser(userId, notification);
  },

  pingResponse: async (userId, responderName, response, venueName, pingId) => {
    const notification = templates.pingResponse(responderName, response, venueName);
    notification.data.pingId = pingId;
    return sendToUser(userId, notification);
  },

  friendRequest: async (userId, senderName, senderId) => {
    const notification = templates.friendRequest(senderName);
    notification.data.senderId = senderId;
    return sendToUser(userId, notification);
  },

  friendAccepted: async (userId, friendName, friendId) => {
    const notification = templates.friendAccepted(friendName);
    notification.data.friendId = friendId;
    return sendToUser(userId, notification);
  },

  friendsGathering: async (userId, count, venueName, venueId) => {
    const notification = templates.friendsGathering(count, venueName);
    notification.data.venueId = venueId;
    return sendToUser(userId, notification);
  },
};

/**
 * Notify all friends when a user starts going out
 * @param {string} userId - User who started going out
 * @param {string[]} friendIds - Friends to notify
 */
const notifyFriendsGoingOut = async (userId, friendIds, userName) => {
  const notification = templates.friendGoingOut(userName);
  return sendToUsers(friendIds, notification);
};

/**
 * Check for friend clusters and notify (3+ friends at same venue)
 */
const checkAndNotifyFriendCluster = async (venueId, venueName, userIds) => {
  if (userIds.length < 3) return;

  // Get all users who have friends at this venue
  const potentialNotifyees = new Set();
  
  for (const userId of userIds) {
    const friends = await db.manyOrNone(`
      SELECT 
        CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END as friend_id
      FROM friendships
      WHERE (requester_id = $1 OR addressee_id = $1)
        AND status = 'accepted'
    `, [userId]);

    friends.forEach(f => {
      if (!userIds.includes(f.friend_id)) {
        potentialNotifyees.add(f.friend_id);
      }
    });
  }

  // Notify users who have friends gathering
  for (const notifyUserId of potentialNotifyees) {
    const friendsAtVenue = userIds.filter(async (uid) => {
      const areFriends = await db.oneOrNone(`
        SELECT 1 FROM friendships
        WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
          AND status = 'accepted'
      `, [notifyUserId, uid]);
      return !!areFriends;
    });

    if (friendsAtVenue.length >= 3) {
      await notify.friendsGathering(notifyUserId, friendsAtVenue.length, venueName, venueId);
    }
  }
};

module.exports = {
  registerDevice,
  unregisterDevice,
  getUserTokens,
  sendToUser,
  sendToUsers,
  notify,
  notifyFriendsGoingOut,
  checkAndNotifyFriendCluster,
  templates,
};
