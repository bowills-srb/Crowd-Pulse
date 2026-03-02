const express = require('express');
const Joi = require('joi');
const { db } = require('../config/database');
const { User } = require('../models');
const { generateTokens, verifyRefreshToken, authenticate } = require('../middleware/auth');
const { sendOTP, formatPhoneE164 } = require('../services/twilioService');

const router = express.Router();

// Validation schemas
const phoneSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid phone number format',
    }),
});

const verifySchema = Joi.object({
  phone: Joi.string().required(),
  code: Joi.string().length(6).required(),
  displayName: Joi.string().min(2).max(50).optional(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

/**
 * Send OTP code to phone number
 * POST /auth/send-code
 */
router.post('/send-code', async (req, res) => {
  try {
    const { error, value } = phoneSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Format phone to E.164
    const phone = formatPhoneE164(value.phone);

    // Rate limiting: Check recent OTP attempts
    const recentAttempts = await db.oneOrNone(`
      SELECT COUNT(*) as count
      FROM otp_codes
      WHERE phone = $1
        AND created_at > NOW() - INTERVAL '1 hour'
    `, [phone]);

    if (recentAttempts && parseInt(recentAttempts.count) >= 5) {
      return res.status(429).json({ 
        error: 'Too many verification attempts. Please try again later.' 
      });
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    await db.none(`
      INSERT INTO otp_codes (phone, code, expires_at)
      VALUES ($1, $2, $3)
    `, [phone, code, expiresAt]);

    // Send via Twilio (or log in dev mode)
    try {
      await sendOTP(phone, code);
    } catch (smsError) {
      console.error('SMS send error:', smsError.message);
      return res.status(500).json({ error: smsError.message });
    }

    // Check if user exists
    const existingUser = await User.findByPhone(phone);

    res.json({
      success: true,
      message: 'Verification code sent',
      isNewUser: !existingUser,
      // Only include code in development when Twilio is disabled
      ...((process.env.NODE_ENV !== 'production' && !process.env.TWILIO_ENABLED) && { code }),
    });
  } catch (error) {
    console.error('Send code error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

/**
 * Verify OTP and login/register
 * POST /auth/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { error, value } = verifySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { phone, code, displayName } = value;

    // Find valid OTP
    const otpRecord = await db.oneOrNone(`
      SELECT * FROM otp_codes
      WHERE phone = $1 
        AND code = $2 
        AND expires_at > NOW()
        AND verified = false
        AND attempts < 5
      ORDER BY created_at DESC
      LIMIT 1
    `, [phone, code]);

    if (!otpRecord) {
      // Increment attempts for rate limiting
      await db.none(`
        UPDATE otp_codes
        SET attempts = attempts + 1
        WHERE phone = $1 AND verified = false
      `, [phone]);

      return res.status(401).json({ error: 'Invalid or expired verification code' });
    }

    // Mark OTP as verified
    await db.none('UPDATE otp_codes SET verified = true WHERE id = $1', [otpRecord.id]);

    // Find or create user
    let user = await User.findByPhone(phone);
    let isNewUser = false;

    if (!user) {
      if (!displayName) {
        return res.status(400).json({ 
          error: 'Display name required for new users',
          isNewUser: true,
        });
      }
      user = await User.create({ phone, displayName });
      await User.verifyPhone(user.id);
      isNewUser = true;
    }

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Store refresh token hash
    const bcrypt = require('bcryptjs');
    const tokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await db.none(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '30 days')
    `, [user.id, tokenHash]);

    res.json({
      success: true,
      isNewUser,
      user: {
        id: user.id,
        phone: user.phone,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        settings: user.settings,
      },
      ...tokens,
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * Refresh access token
 * POST /auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { error, value } = refreshSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { refreshToken } = value;

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token exists in database
    const bcrypt = require('bcryptjs');
    const storedTokens = await db.manyOrNone(`
      SELECT * FROM refresh_tokens
      WHERE user_id = $1 AND expires_at > NOW()
    `, [decoded.userId]);

    let validToken = null;
    for (const stored of storedTokens) {
      if (await bcrypt.compare(refreshToken, stored.token_hash)) {
        validToken = stored;
        break;
      }
    }

    if (!validToken) {
      return res.status(401).json({ error: 'Refresh token not found or expired' });
    }

    // Get user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new tokens
    const tokens = generateTokens(user.id);

    // Update refresh token in database
    const newTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await db.none(`
      UPDATE refresh_tokens
      SET token_hash = $1, expires_at = NOW() + INTERVAL '30 days'
      WHERE id = $2
    `, [newTokenHash, validToken.id]);

    res.json({
      success: true,
      ...tokens,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * Logout - invalidate refresh token
 * POST /auth/logout
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Delete all refresh tokens for this user
    await db.none('DELETE FROM refresh_tokens WHERE user_id = $1', [req.userId]);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * Get current user
 * GET /auth/me
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
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

module.exports = router;
