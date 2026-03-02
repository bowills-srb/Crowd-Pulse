/**
 * Migration: Add device tokens, venue owners, and promotions
 * Run: npx node-pg-migrate up
 */

exports.up = (pgm) => {
  // Device tokens for push notifications
  pgm.createTable('device_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    token: { type: 'text', notNull: true, unique: true },
    platform: { type: 'varchar(20)', notNull: true }, // 'ios' or 'android'
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('device_tokens', 'user_id');

  // Venue owners (B2B accounts)
  pgm.createTable('venue_owners', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    name: { type: 'varchar(100)', notNull: true },
    phone: { type: 'varchar(20)' },
    company_name: { type: 'varchar(100)' },
    subscription_tier: { type: 'varchar(20)', default: 'free' }, // free, basic, pro
    subscription_status: { type: 'varchar(20)', default: 'active' },
    stripe_customer_id: { type: 'varchar(100)' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    last_login_at: { type: 'timestamptz' },
  });

  // Link venue owners to venues
  pgm.createTable('venue_owner_venues', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    venue_owner_id: { type: 'uuid', notNull: true, references: 'venue_owners', onDelete: 'CASCADE' },
    venue_id: { type: 'uuid', notNull: true, references: 'venues', onDelete: 'CASCADE' },
    role: { type: 'varchar(20)', default: 'owner' }, // owner, manager
    verified: { type: 'boolean', default: false },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.addConstraint('venue_owner_venues', 'unique_owner_venue', {
    unique: ['venue_owner_id', 'venue_id'],
  });

  // Venue promotions
  pgm.createTable('venue_promotions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    venue_id: { type: 'uuid', notNull: true, references: 'venues', onDelete: 'CASCADE' },
    venue_owner_id: { type: 'uuid', notNull: true, references: 'venue_owners', onDelete: 'CASCADE' },
    title: { type: 'varchar(100)', notNull: true },
    description: { type: 'text' },
    promo_type: { type: 'varchar(30)', notNull: true }, // happy_hour, event, discount, special
    discount_percent: { type: 'integer' },
    start_time: { type: 'timestamptz', notNull: true },
    end_time: { type: 'timestamptz', notNull: true },
    capacity_trigger: { type: 'integer' }, // Show promo when below this % capacity
    target_audience: { type: 'varchar(20)', default: 'all' }, // all, nearby, lowkey_seekers
    push_notification: { type: 'boolean', default: false },
    status: { type: 'varchar(20)', default: 'active' },
    impressions: { type: 'integer', default: 0 },
    clicks: { type: 'integer', default: 0 },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('venue_promotions', 'venue_id');
  pgm.createIndex('venue_promotions', ['status', 'start_time', 'end_time']);

  // Venue analytics (daily aggregates)
  pgm.createTable('venue_analytics', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    venue_id: { type: 'uuid', notNull: true, references: 'venues', onDelete: 'CASCADE' },
    date: { type: 'date', notNull: true },
    peak_crowd: { type: 'integer' },
    peak_capacity_percent: { type: 'integer' },
    peak_time: { type: 'time' },
    avg_capacity_percent: { type: 'integer' },
    total_check_ins: { type: 'integer', default: 0 },
    unique_visitors: { type: 'integer', default: 0 },
    avg_dwell_time_minutes: { type: 'integer' },
    impressions: { type: 'integer', default: 0 }, // Times venue shown in search
    profile_views: { type: 'integer', default: 0 },
  });

  pgm.addConstraint('venue_analytics', 'unique_venue_date', {
    unique: ['venue_id', 'date'],
  });

  pgm.createIndex('venue_analytics', ['venue_id', 'date']);
};

exports.down = (pgm) => {
  pgm.dropTable('venue_analytics');
  pgm.dropTable('venue_promotions');
  pgm.dropTable('venue_owner_venues');
  pgm.dropTable('venue_owners');
  pgm.dropTable('device_tokens');
};
