/**
 * B2B Venue Owner API Routes
 * Dashboard for venue analytics and promotions
 */

const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// =====================
// AUTH MIDDLEWARE
// =====================
const authenticateOwner = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'venue_owner') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    req.ownerId = decoded.ownerId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// =====================
// AUTH ROUTES
// =====================
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().optional(),
  companyName: Joi.string().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

router.post('/auth/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Check if email exists
    const existing = await db.oneOrNone(
      'SELECT id FROM venue_owners WHERE email = $1',
      [value.email.toLowerCase()]
    );
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(value.password, 12);

    // Create owner
    const owner = await db.one(`
      INSERT INTO venue_owners (email, password_hash, name, phone, company_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, name, company_name, subscription_tier
    `, [value.email.toLowerCase(), passwordHash, value.name, value.phone, value.companyName]);

    // Generate token
    const token = jwt.sign(
      { ownerId: owner.id, type: 'venue_owner' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      owner: {
        id: owner.id,
        email: owner.email,
        name: owner.name,
        companyName: owner.company_name,
        subscriptionTier: owner.subscription_tier,
      },
    });
  } catch (error) {
    console.error('Owner register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const owner = await db.oneOrNone(
      'SELECT * FROM venue_owners WHERE email = $1',
      [value.email.toLowerCase()]
    );
    
    if (!owner || !(await bcrypt.compare(value.password, owner.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await db.none('UPDATE venue_owners SET last_login_at = NOW() WHERE id = $1', [owner.id]);

    const token = jwt.sign(
      { ownerId: owner.id, type: 'venue_owner' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      owner: {
        id: owner.id,
        email: owner.email,
        name: owner.name,
        companyName: owner.company_name,
        subscriptionTier: owner.subscription_tier,
      },
    });
  } catch (error) {
    console.error('Owner login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/auth/me', authenticateOwner, async (req, res) => {
  try {
    const owner = await db.one(
      'SELECT id, email, name, phone, company_name, subscription_tier, subscription_status, created_at FROM venue_owners WHERE id = $1',
      [req.ownerId]
    );

    res.json({
      id: owner.id,
      email: owner.email,
      name: owner.name,
      phone: owner.phone,
      companyName: owner.company_name,
      subscriptionTier: owner.subscription_tier,
      subscriptionStatus: owner.subscription_status,
      createdAt: owner.created_at,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// =====================
// VENUE ROUTES
// =====================
router.get('/venues', authenticateOwner, async (req, res) => {
  try {
    const venues = await db.manyOrNone(`
      SELECT 
        v.*,
        vov.role,
        vov.verified,
        cr.capacity_percentage as current_crowd,
        cr.trend
      FROM venue_owner_venues vov
      JOIN venues v ON v.id = vov.venue_id
      LEFT JOIN LATERAL (
        SELECT capacity_percentage, trend
        FROM crowd_readings
        WHERE venue_id = v.id
        ORDER BY recorded_at DESC
        LIMIT 1
      ) cr ON true
      WHERE vov.venue_owner_id = $1
    `, [req.ownerId]);

    res.json({
      venues: venues.map(v => ({
        id: v.id,
        name: v.name,
        address: v.address,
        category: v.category,
        estimatedCapacity: v.estimated_capacity,
        role: v.role,
        verified: v.verified,
        currentCrowd: v.current_crowd,
        trend: v.trend,
      })),
    });
  } catch (error) {
    console.error('Get venues error:', error);
    res.status(500).json({ error: 'Failed to get venues' });
  }
});

router.post('/venues/claim', authenticateOwner, async (req, res) => {
  try {
    const { venueId } = req.body;
    
    // Check venue exists
    const venue = await db.oneOrNone('SELECT * FROM venues WHERE id = $1', [venueId]);
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    // Check not already claimed
    const existing = await db.oneOrNone(
      'SELECT * FROM venue_owner_venues WHERE venue_id = $1',
      [venueId]
    );
    if (existing) {
      return res.status(400).json({ error: 'Venue already claimed' });
    }

    // Claim venue (unverified)
    await db.none(`
      INSERT INTO venue_owner_venues (venue_owner_id, venue_id, role, verified)
      VALUES ($1, $2, 'owner', false)
    `, [req.ownerId, venueId]);

    res.json({ success: true, message: 'Venue claimed - verification pending' });
  } catch (error) {
    console.error('Claim venue error:', error);
    res.status(500).json({ error: 'Failed to claim venue' });
  }
});

// =====================
// ANALYTICS ROUTES
// =====================
router.get('/venues/:venueId/analytics', authenticateOwner, async (req, res) => {
  try {
    const { venueId } = req.params;
    const { period = '7d' } = req.query;

    // Verify ownership
    const ownership = await db.oneOrNone(
      'SELECT * FROM venue_owner_venues WHERE venue_owner_id = $1 AND venue_id = $2',
      [req.ownerId, venueId]
    );
    if (!ownership) {
      return res.status(403).json({ error: 'Not your venue' });
    }

    // Calculate date range
    const days = period === '30d' ? 30 : period === '7d' ? 7 : 1;
    
    // Get daily analytics
    const dailyStats = await db.manyOrNone(`
      SELECT * FROM venue_analytics
      WHERE venue_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
    `, [venueId]);

    // Get hourly crowd averages
    const hourlyAverages = await db.manyOrNone(`
      SELECT 
        EXTRACT(HOUR FROM recorded_at) as hour,
        ROUND(AVG(capacity_percentage)) as avg_capacity,
        ROUND(AVG(estimated_count)) as avg_count
      FROM crowd_readings
      WHERE venue_id = $1 
        AND recorded_at >= NOW() - INTERVAL '${days} days'
      GROUP BY EXTRACT(HOUR FROM recorded_at)
      ORDER BY hour
    `, [venueId]);

    // Get real-time crowd
    const currentCrowd = await db.oneOrNone(`
      SELECT * FROM crowd_readings
      WHERE venue_id = $1
      ORDER BY recorded_at DESC
      LIMIT 1
    `, [venueId]);

    // Get recent check-ins
    const recentCheckIns = await db.oneOrNone(`
      SELECT COUNT(*) as count
      FROM user_presence
      WHERE venue_id = $1 
        AND status = 'at_venue'
        AND updated_at >= NOW() - INTERVAL '24 hours'
    `, [venueId]);

    res.json({
      daily: dailyStats.map(d => ({
        date: d.date,
        peakCrowd: d.peak_crowd,
        peakCapacity: d.peak_capacity_percent,
        peakTime: d.peak_time,
        avgCapacity: d.avg_capacity_percent,
        checkIns: d.total_check_ins,
        uniqueVisitors: d.unique_visitors,
        avgDwellTime: d.avg_dwell_time_minutes,
        impressions: d.impressions,
        profileViews: d.profile_views,
      })),
      hourly: hourlyAverages.map(h => ({
        hour: parseInt(h.hour),
        avgCapacity: parseInt(h.avg_capacity),
        avgCount: parseInt(h.avg_count),
      })),
      current: currentCrowd ? {
        percentage: currentCrowd.capacity_percentage,
        count: currentCrowd.estimated_count,
        trend: currentCrowd.trend,
        updatedAt: currentCrowd.recorded_at,
      } : null,
      todayCheckIns: parseInt(recentCheckIns?.count || 0),
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

router.get('/venues/:venueId/live', authenticateOwner, async (req, res) => {
  try {
    const { venueId } = req.params;

    // Verify ownership
    const ownership = await db.oneOrNone(
      'SELECT * FROM venue_owner_venues WHERE venue_owner_id = $1 AND venue_id = $2',
      [req.ownerId, venueId]
    );
    if (!ownership) {
      return res.status(403).json({ error: 'Not your venue' });
    }

    // Get current users at venue (anonymous count)
    const userCount = await db.oneOrNone(`
      SELECT COUNT(*) as count
      FROM user_presence
      WHERE venue_id = $1 AND status = 'at_venue'
    `, [venueId]);

    // Get recent crowd readings (last hour)
    const readings = await db.manyOrNone(`
      SELECT capacity_percentage, estimated_count, recorded_at
      FROM crowd_readings
      WHERE venue_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour'
      ORDER BY recorded_at DESC
    `, [venueId]);

    res.json({
      appUsers: parseInt(userCount?.count || 0),
      estimatedTotal: readings[0]?.estimated_count || 0,
      capacityPercent: readings[0]?.capacity_percentage || 0,
      recentReadings: readings.map(r => ({
        percent: r.capacity_percentage,
        count: r.estimated_count,
        time: r.recorded_at,
      })),
    });
  } catch (error) {
    console.error('Get live data error:', error);
    res.status(500).json({ error: 'Failed to get live data' });
  }
});

// =====================
// PROMOTION ROUTES
// =====================
const promoSchema = Joi.object({
  title: Joi.string().max(100).required(),
  description: Joi.string().max(500).optional(),
  promoType: Joi.string().valid('happy_hour', 'event', 'discount', 'special').required(),
  discountPercent: Joi.number().min(0).max(100).optional(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  capacityTrigger: Joi.number().min(0).max(100).optional(),
  targetAudience: Joi.string().valid('all', 'nearby', 'lowkey_seekers').default('all'),
  pushNotification: Joi.boolean().default(false),
});

router.get('/venues/:venueId/promotions', authenticateOwner, async (req, res) => {
  try {
    const { venueId } = req.params;

    const ownership = await db.oneOrNone(
      'SELECT * FROM venue_owner_venues WHERE venue_owner_id = $1 AND venue_id = $2',
      [req.ownerId, venueId]
    );
    if (!ownership) {
      return res.status(403).json({ error: 'Not your venue' });
    }

    const promotions = await db.manyOrNone(`
      SELECT * FROM venue_promotions
      WHERE venue_id = $1
      ORDER BY created_at DESC
    `, [venueId]);

    res.json({
      promotions: promotions.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        promoType: p.promo_type,
        discountPercent: p.discount_percent,
        startTime: p.start_time,
        endTime: p.end_time,
        capacityTrigger: p.capacity_trigger,
        targetAudience: p.target_audience,
        pushNotification: p.push_notification,
        status: p.status,
        impressions: p.impressions,
        clicks: p.clicks,
        createdAt: p.created_at,
      })),
    });
  } catch (error) {
    console.error('Get promotions error:', error);
    res.status(500).json({ error: 'Failed to get promotions' });
  }
});

router.post('/venues/:venueId/promotions', authenticateOwner, async (req, res) => {
  try {
    const { venueId } = req.params;
    const { error, value } = promoSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const ownership = await db.oneOrNone(
      'SELECT * FROM venue_owner_venues WHERE venue_owner_id = $1 AND venue_id = $2',
      [req.ownerId, venueId]
    );
    if (!ownership) {
      return res.status(403).json({ error: 'Not your venue' });
    }

    // Check subscription tier for push notifications
    if (value.pushNotification) {
      const owner = await db.one('SELECT subscription_tier FROM venue_owners WHERE id = $1', [req.ownerId]);
      if (owner.subscription_tier === 'free') {
        return res.status(403).json({ error: 'Push notifications require Basic or Pro subscription' });
      }
    }

    const promo = await db.one(`
      INSERT INTO venue_promotions (
        venue_id, venue_owner_id, title, description, promo_type,
        discount_percent, start_time, end_time, capacity_trigger,
        target_audience, push_notification
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      venueId, req.ownerId, value.title, value.description, value.promoType,
      value.discountPercent, value.startTime, value.endTime, value.capacityTrigger,
      value.targetAudience, value.pushNotification,
    ]);

    res.status(201).json({
      id: promo.id,
      title: promo.title,
      status: promo.status,
    });
  } catch (error) {
    console.error('Create promotion error:', error);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

router.delete('/venues/:venueId/promotions/:promoId', authenticateOwner, async (req, res) => {
  try {
    const { venueId, promoId } = req.params;

    const ownership = await db.oneOrNone(
      'SELECT * FROM venue_owner_venues WHERE venue_owner_id = $1 AND venue_id = $2',
      [req.ownerId, venueId]
    );
    if (!ownership) {
      return res.status(403).json({ error: 'Not your venue' });
    }

    await db.none(
      'DELETE FROM venue_promotions WHERE id = $1 AND venue_id = $2',
      [promoId, venueId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

// =====================
// SEARCH VENUES (for claiming)
// =====================
router.get('/venues/search', authenticateOwner, async (req, res) => {
  try {
    const { q, lat, lng } = req.query;

    let venues;
    if (q) {
      venues = await db.manyOrNone(`
        SELECT id, name, address, category
        FROM venues
        WHERE name ILIKE $1
        LIMIT 20
      `, [`%${q}%`]);
    } else if (lat && lng) {
      venues = await db.manyOrNone(`
        SELECT id, name, address, category,
          ST_Distance(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance
        FROM venues
        ORDER BY location <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        LIMIT 20
      `, [lat, lng]);
    } else {
      return res.status(400).json({ error: 'Provide search query or location' });
    }

    res.json({ venues });
  } catch (error) {
    console.error('Search venues error:', error);
    res.status(500).json({ error: 'Failed to search venues' });
  }
});

module.exports = router;
