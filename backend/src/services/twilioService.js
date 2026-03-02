/**
 * Twilio SMS Service
 * Handles sending OTP codes and other SMS notifications
 */

const twilio = require('twilio');

const isTwilioEnabled = () => String(process.env.TWILIO_ENABLED).toLowerCase() === 'true';
const hasTwilioCredentials = () =>
  !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;

const getClient = () => {
  if (!isTwilioEnabled() || !hasTwilioCredentials()) {
    return null;
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
};

const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

/**
 * Send an OTP verification code via SMS
 * @param {string} phone - Recipient phone number (E.164 format: +1XXXXXXXXXX)
 * @param {string} code - 6-digit verification code
 * @returns {Promise<object>} Twilio message response
 */
const sendOTP = async (phone, code) => {
  // In development, just log the code
  if (process.env.NODE_ENV !== 'production' && !isTwilioEnabled()) {
    console.log(`\n📱 OTP for ${phone}: ${code}\n`);
    return { sid: 'dev-mode', status: 'sent' };
  }

  // Validate Twilio credentials exist
  if (!hasTwilioCredentials() || !TWILIO_PHONE) {
    console.error('Twilio credentials not configured');
    throw new Error('SMS service not configured');
  }

  try {
    const client = getClient();
    const message = await client.messages.create({
      body: `Your CrowdPulse verification code is: ${code}\n\nThis code expires in 10 minutes.`,
      from: TWILIO_PHONE,
      to: phone,
    });

    console.log(`SMS sent to ${phone}: ${message.sid}`);
    return {
      sid: message.sid,
      status: message.status,
    };
  } catch (error) {
    console.error('Twilio SMS error:', error.message);
    
    // Handle specific Twilio errors
    if (error.code === 21211) {
      throw new Error('Invalid phone number format');
    }
    if (error.code === 21614) {
      throw new Error('Phone number is not a valid mobile number');
    }
    if (error.code === 21408) {
      throw new Error('SMS not supported for this region');
    }
    
    throw new Error('Failed to send verification code');
  }
};

/**
 * Send a venue ping notification via SMS (for non-app users)
 * @param {string} phone - Recipient phone number
 * @param {string} senderName - Name of person sending the ping
 * @param {string} venueName - Name of the venue
 * @param {string} message - Optional custom message
 */
const sendPingNotification = async (phone, senderName, venueName, message = null) => {
  if (process.env.NODE_ENV !== 'production' && !isTwilioEnabled()) {
    console.log(`\n📍 Ping notification to ${phone}: ${senderName} at ${venueName}\n`);
    return { sid: 'dev-mode', status: 'sent' };
  }

  if (!hasTwilioCredentials() || !TWILIO_PHONE) {
    throw new Error('SMS service not configured');
  }

  let body = `${senderName} wants to meet up at ${venueName}!`;
  if (message) {
    body += `\n\n"${message}"`;
  }
  body += `\n\nDownload CrowdPulse to respond: https://crowdpulse.app/download`;

  try {
    const client = getClient();
    const smsMessage = await client.messages.create({
      body,
      from: TWILIO_PHONE,
      to: phone,
    });

    return {
      sid: smsMessage.sid,
      status: smsMessage.status,
    };
  } catch (error) {
    console.error('Twilio ping notification error:', error.message);
    throw new Error('Failed to send notification');
  }
};

/**
 * Send a friend request notification via SMS (for viral growth)
 * @param {string} phone - Recipient phone number
 * @param {string} senderName - Name of person sending the request
 */
const sendFriendInvite = async (phone, senderName) => {
  if (process.env.NODE_ENV !== 'production' && !isTwilioEnabled()) {
    console.log(`\n👋 Friend invite to ${phone} from ${senderName}\n`);
    return { sid: 'dev-mode', status: 'sent' };
  }

  if (!hasTwilioCredentials() || !TWILIO_PHONE) {
    throw new Error('SMS service not configured');
  }

  try {
    const client = getClient();
    const message = await client.messages.create({
      body: `${senderName} added you on CrowdPulse! See where your friends are heading tonight.\n\nJoin here: https://crowdpulse.app/download`,
      from: TWILIO_PHONE,
      to: phone,
    });

    return {
      sid: message.sid,
      status: message.status,
    };
  } catch (error) {
    console.error('Twilio friend invite error:', error.message);
    throw new Error('Failed to send invite');
  }
};

/**
 * Validate phone number format using Twilio Lookup API
 * @param {string} phone - Phone number to validate
 * @returns {Promise<object>} Validated phone info
 */
const validatePhone = async (phone) => {
  if (process.env.NODE_ENV !== 'production' && !isTwilioEnabled()) {
    // Basic validation in dev mode
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10 || cleaned.length > 15) {
      throw new Error('Invalid phone number');
    }
    return { valid: true, phone, type: 'mobile' };
  }

  if (!hasTwilioCredentials()) {
    // Fallback to basic validation
    const cleaned = phone.replace(/\D/g, '');
    return { valid: cleaned.length >= 10, phone };
  }

  try {
    const client = getClient();
    const lookup = await client.lookups.v2.phoneNumbers(phone).fetch({
      fields: 'line_type_intelligence',
    });

    return {
      valid: true,
      phone: lookup.phoneNumber,
      countryCode: lookup.countryCode,
      type: lookup.lineTypeIntelligence?.type || 'unknown',
    };
  } catch (error) {
    if (error.code === 20404) {
      throw new Error('Phone number not found');
    }
    throw new Error('Failed to validate phone number');
  }
};

/**
 * Format phone number to E.164 format
 * @param {string} phone - Raw phone input
 * @param {string} defaultCountry - Default country code (default: 'US')
 * @returns {string} E.164 formatted phone number
 */
const formatPhoneE164 = (phone, defaultCountry = 'US') => {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If no country code, assume US
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
};

module.exports = {
  sendOTP,
  sendPingNotification,
  sendFriendInvite,
  validatePhone,
  formatPhoneE164,
};
