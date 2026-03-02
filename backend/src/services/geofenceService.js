/**
 * Radar.io Geofencing Service
 * Auto check-in when users arrive at venues
 */

const axios = require('axios');
const { db } = require('../config/database');
const { Venue, UserPresence } = require('../models');
const { notify } = require('./pushService');

const RADAR_SECRET_KEY = process.env.RADAR_SECRET_KEY;
const RADAR_PUBLISHABLE_KEY = process.env.RADAR_PUBLISHABLE_KEY;
const RADAR_BASE_URL = 'https://api.radar.io/v1';

/**
 * Create a geofence for a venue
 * @param {object} venue - Venue object with id, name, lat, lng
 */
const createGeofence = async (venue) => {
  if (!RADAR_SECRET_KEY) {
    console.log('Radar not configured - skipping geofence creation');
    return null;
  }

  try {
    const response = await axios.post(
      `${RADAR_BASE_URL}/geofences`,
      {
        description: venue.name,
        type: 'circle',
        externalId: venue.id,
        tag: 'venue',
        coordinates: [venue.longitude, venue.latitude],
        radius: 50, // 50 meter radius
        metadata: {
          venueId: venue.id,
          venueName: venue.name,
          category: venue.category,
        },
      },
      {
        headers: {
          Authorization: RADAR_SECRET_KEY,
        },
      }
    );

    console.log(`Created geofence for ${venue.name}`);
    return response.data.geofence;
  } catch (error) {
    console.error('Radar geofence creation error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete a geofence
 * @param {string} venueId - External ID (our venue ID)
 */
const deleteGeofence = async (venueId) => {
  if (!RADAR_SECRET_KEY) return;

  try {
    await axios.delete(
      `${RADAR_BASE_URL}/geofences/venue/${venueId}`,
      {
        headers: {
          Authorization: RADAR_SECRET_KEY,
        },
      }
    );
    console.log(`Deleted geofence for venue ${venueId}`);
  } catch (error) {
    console.error('Radar geofence deletion error:', error.response?.data || error.message);
  }
};

/**
 * Sync all venues to Radar geofences
 */
const syncAllGeofences = async () => {
  const venues = await db.manyOrNone('SELECT * FROM venues');
  
  let created = 0;
  let errors = 0;

  for (const venue of venues) {
    try {
      await createGeofence({
        id: venue.id,
        name: venue.name,
        latitude: parseFloat(venue.latitude) || venue.location?.y,
        longitude: parseFloat(venue.longitude) || venue.location?.x,
        category: venue.category,
      });
      created++;
      
      // Rate limit
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      errors++;
    }
  }

  return { created, errors, total: venues.length };
};

/**
 * Handle Radar webhook event
 * Called when user enters/exits a geofence
 */
const handleWebhook = async (event) => {
  const { type, user, geofence, location } = event;
  
  if (!user?.userId || !geofence?.externalId) {
    console.log('Invalid webhook payload');
    return { handled: false };
  }

  const userId = user.userId;
  const venueId = geofence.externalId;
  const venueName = geofence.metadata?.venueName || geofence.description;

  console.log(`Radar event: ${type} - User ${userId} at ${venueName}`);

  if (type === 'user.entered_geofence') {
    return handleGeofenceEntry(userId, venueId, venueName, location);
  } else if (type === 'user.exited_geofence') {
    return handleGeofenceExit(userId, venueId);
  }

  return { handled: false };
};

/**
 * Handle user entering a venue geofence
 */
const handleGeofenceEntry = async (userId, venueId, venueName, location) => {
  // Check if user is in "going out" mode
  const presence = await UserPresence.getPresence(userId);
  
  if (!presence || presence.status === 'offline') {
    // User not sharing location - don't auto check-in
    return { handled: true, action: 'ignored', reason: 'User not going out' };
  }

  // Check user's auto check-in preference
  const user = await db.oneOrNone('SELECT settings FROM users WHERE id = $1', [userId]);
  const autoCheckIn = user?.settings?.autoCheckIn !== false; // Default true

  if (!autoCheckIn) {
    return { handled: true, action: 'ignored', reason: 'Auto check-in disabled' };
  }

  // Auto check-in to venue
  await UserPresence.checkIn(userId, venueId, presence.sharing_mode, presence.sharing_with);

  // Notify friends
  const friends = await db.manyOrNone(`
    SELECT 
      CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END as friend_id
    FROM friendships
    WHERE (requester_id = $1 OR addressee_id = $1)
      AND status = 'accepted'
  `, [userId]);

  const userName = await db.oneOrNone('SELECT display_name FROM users WHERE id = $1', [userId]);

  for (const friend of friends) {
    await notify.friendAtVenue(friend.friend_id, userName?.display_name, venueName);
  }

  // Update crowd reading
  const { CrowdReading } = require('../models');
  await CrowdReading.calculateFromPresence(venueId);

  return { 
    handled: true, 
    action: 'checked_in', 
    venueId, 
    venueName,
  };
};

/**
 * Handle user exiting a venue geofence
 */
const handleGeofenceExit = async (userId, venueId) => {
  const presence = await UserPresence.getPresence(userId);
  
  // Only update if user was checked in at this venue
  if (presence?.venue_id === venueId) {
    // Set back to "going out" status (still sharing, just not at venue)
    await db.none(`
      UPDATE user_presence
      SET status = 'going_out', venue_id = NULL, updated_at = NOW()
      WHERE user_id = $1
    `, [userId]);

    // Update crowd reading
    const { CrowdReading } = require('../models');
    await CrowdReading.calculateFromPresence(venueId);

    return { handled: true, action: 'checked_out', venueId };
  }

  return { handled: true, action: 'ignored' };
};

/**
 * Track user location (called from mobile app)
 * Returns nearby geofences for client-side monitoring
 */
const trackLocation = async (userId, latitude, longitude) => {
  if (!RADAR_SECRET_KEY) {
    return { tracked: false, reason: 'Radar not configured' };
  }

  try {
    const response = await axios.post(
      `${RADAR_BASE_URL}/track`,
      {
        userId,
        latitude,
        longitude,
        accuracy: 20,
        foreground: true,
      },
      {
        headers: {
          Authorization: RADAR_SECRET_KEY,
        },
      }
    );

    return {
      tracked: true,
      location: response.data.location,
      geofences: response.data.geofences,
      nearbyPlaces: response.data.place,
    };
  } catch (error) {
    console.error('Radar track error:', error.response?.data || error.message);
    return { tracked: false, reason: error.message };
  }
};

/**
 * Get Radar publishable key for mobile SDK
 */
const getPublishableKey = () => {
  return RADAR_PUBLISHABLE_KEY || null;
};

/**
 * Express router for Radar webhooks
 */
const createWebhookRouter = () => {
  const express = require('express');
  const router = express.Router();

  router.post('/radar', async (req, res) => {
    try {
      // Verify webhook signature (optional but recommended)
      // const signature = req.headers['x-radar-signature'];
      
      const events = Array.isArray(req.body) ? req.body : [req.body];
      const results = [];

      for (const event of events) {
        const result = await handleWebhook(event);
        results.push(result);
      }

      res.json({ success: true, results });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  return router;
};

module.exports = {
  createGeofence,
  deleteGeofence,
  syncAllGeofences,
  handleWebhook,
  handleGeofenceEntry,
  handleGeofenceExit,
  trackLocation,
  getPublishableKey,
  createWebhookRouter,
};
