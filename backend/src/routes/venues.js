const express = require('express');
const Joi = require('joi');
const { Venue, CrowdReading, VenuePing } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const nearbySchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().min(100).max(50000).default(5000),
  category: Joi.string().optional(),
  vibe: Joi.string().valid('lively', 'lowkey', 'any').default('any'),
  limit: Joi.number().min(1).max(100).default(50),
});

const searchSchema = Joi.object({
  q: Joi.string().min(2).required(),
  city: Joi.string().optional(),
  category: Joi.string().optional(),
  limit: Joi.number().min(1).max(50).default(20),
});

/**
 * Get venue categories
 * GET /venues/meta/categories
 */
router.get('/meta/categories', authenticate, async (req, res) => {
  try {
    const categories = await Venue.getCategories();
    res.json({ categories });
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * Get trending venues (rapidly filling up)
 * GET /venues/discover/trending
 */
router.get('/discover/trending', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000, limit = 10 } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location required' });
    }

    const venues = await CrowdReading.getTrendingVenues(
      parseFloat(latitude),
      parseFloat(longitude),
      parseInt(radius),
      parseInt(limit)
    );

    res.json({
      venues: venues.map(venue => ({
        id: venue.id,
        name: venue.name,
        category: venue.category,
        location: {
          latitude: venue.latitude,
          longitude: venue.longitude,
        },
        distance: Math.round(venue.distance_meters),
        crowd: {
          percentage: Math.round(venue.capacity_percentage),
          trend: venue.trend,
        },
      })),
    });
  } catch (error) {
    console.error('Trending venues error:', error);
    res.status(500).json({ error: 'Failed to fetch trending venues' });
  }
});

/**
 * Get quiet venues (for lowkey vibe)
 * GET /venues/discover/quiet
 */
router.get('/discover/quiet', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000, limit = 10 } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location required' });
    }

    const venues = await CrowdReading.getQuietVenues(
      parseFloat(latitude),
      parseFloat(longitude),
      parseInt(radius),
      parseInt(limit)
    );

    res.json({
      venues: venues.map(venue => ({
        id: venue.id,
        name: venue.name,
        category: venue.category,
        location: {
          latitude: venue.latitude,
          longitude: venue.longitude,
        },
        distance: Math.round(venue.distance_meters),
        crowd: {
          percentage: Math.round(venue.capacity_percentage || 0),
          trend: venue.trend,
        },
      })),
    });
  } catch (error) {
    console.error('Quiet venues error:', error);
    res.status(500).json({ error: 'Failed to fetch quiet venues' });
  }
});

/**
 * Get nearby venues with crowd data
 * GET /venues/nearby
 */
router.get('/nearby', authenticate, async (req, res) => {
  try {
    const { error, value } = nearbySchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { latitude, longitude, radius, category, vibe, limit } = value;

    const venues = await Venue.findNearbyWithCrowdData(
      latitude,
      longitude,
      radius,
      { category, vibePreference: vibe, limit }
    );

    const response = venues.map(venue => ({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      city: venue.city,
      category: venue.category,
      subcategory: venue.subcategory,
      location: {
        latitude: venue.latitude,
        longitude: venue.longitude,
      },
      distance: Math.round(venue.distance_meters),
      crowd: {
        percentage: venue.capacity_percentage ? Math.round(venue.capacity_percentage) : null,
        count: venue.estimated_count,
        trend: venue.trend,
        confidence: venue.confidence,
        lastUpdate: venue.last_reading_at,
      },
      friendsHere: parseInt(venue.friends_here || 0),
      metadata: venue.metadata,
      isVerified: venue.is_verified,
    }));

    res.json({
      venues: response,
      count: response.length,
      searchArea: {
        center: { latitude, longitude },
        radiusMeters: radius,
      },
    });
  } catch (error) {
    console.error('Nearby venues error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby venues' });
  }
});

/**
 * Search venues by name
 * GET /venues/search
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const { error, value } = searchSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { q, city, category, limit } = value;

    const venues = await Venue.search(q, { city, category, limit });

    res.json({
      venues: venues.map(venue => ({
        id: venue.id,
        name: venue.name,
        address: venue.address,
        city: venue.city,
        category: venue.category,
        location: {
          latitude: venue.latitude,
          longitude: venue.longitude,
        },
      })),
      query: q,
    });
  } catch (error) {
    console.error('Search venues error:', error);
    res.status(500).json({ error: 'Failed to search venues' });
  }
});

/**
 * Get venue details
 * GET /venues/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    const crowdReading = await CrowdReading.getLatest(venue.id);
    const friendsHere = await Venue.getUsersAtVenue(venue.id, req.userId);
    const activePings = await VenuePing.getVenuePings(venue.id);

    const dayOfWeek = new Date().getDay();
    const historicalData = await CrowdReading.getHistoricalAverages(venue.id, dayOfWeek);

    res.json({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      city: venue.city,
      state: venue.state,
      zipCode: venue.zip_code,
      category: venue.category,
      subcategory: venue.subcategory,
      location: {
        latitude: venue.latitude,
        longitude: venue.longitude,
      },
      capacity: venue.estimated_capacity,
      metadata: venue.metadata,
      isVerified: venue.is_verified,
      crowd: crowdReading ? {
        percentage: Math.round(crowdReading.capacity_percentage),
        count: crowdReading.estimated_count,
        trend: crowdReading.trend,
        confidence: crowdReading.confidence,
        lastUpdate: crowdReading.timestamp,
      } : null,
      friendsHere: friendsHere.map(f => ({
        id: f.id,
        displayName: f.display_name,
        avatarUrl: f.avatar_url,
        arrivedAt: f.started_at,
      })),
      activePings: activePings.map(p => ({
        id: p.id,
        senderName: p.sender_name,
        senderAvatar: p.sender_avatar,
        message: p.message,
        inCount: parseInt(p.in_count),
        sentAt: p.sent_at,
      })),
      hourlyAverages: historicalData.map(h => ({
        hour: parseInt(h.hour),
        avgCapacity: Math.round(h.avg_capacity),
        sampleCount: parseInt(h.sample_count),
      })),
    });
  } catch (error) {
    console.error('Get venue error:', error);
    res.status(500).json({ error: 'Failed to fetch venue details' });
  }
});

module.exports = router;
