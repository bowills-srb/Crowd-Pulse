/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Enable PostGIS extension for spatial queries
  pgm.sql('CREATE EXTENSION IF NOT EXISTS postgis;');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // ============================================
  // USERS TABLE
  // ============================================
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    phone: {
      type: 'varchar(20)',
      notNull: true,
      unique: true,
    },
    phone_verified: {
      type: 'boolean',
      default: false,
    },
    display_name: {
      type: 'varchar(50)',
      notNull: true,
    },
    avatar_url: {
      type: 'text',
    },
    age_range: {
      type: 'varchar(10)', // '21-25', '26-30', '31-35', '36+'
    },
    vibe_preference: {
      type: 'varchar(20)',
      default: 'any', // 'lively', 'lowkey', 'any'
    },
    settings: {
      type: 'jsonb',
      default: '{"notifications": true, "defaultSharingMode": "friends", "ghostMode": false}',
    },
    last_active_at: {
      type: 'timestamp with time zone',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('users', 'phone');
  pgm.createIndex('users', 'last_active_at');

  // ============================================
  // FRIENDSHIPS TABLE (Mutual connections)
  // ============================================
  pgm.createTable('friendships', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    requester_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    addressee_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending', // 'pending', 'accepted', 'blocked'
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
    accepted_at: {
      type: 'timestamp with time zone',
    },
  });

  // Ensure unique friendships (no duplicates in either direction)
  pgm.sql(`
    CREATE UNIQUE INDEX idx_friendships_unique 
    ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
  `);
  pgm.createIndex('friendships', 'requester_id');
  pgm.createIndex('friendships', 'addressee_id');
  pgm.createIndex('friendships', 'status');

  // ============================================
  // GROUPS TABLE
  // ============================================
  pgm.createTable('groups', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    name: {
      type: 'varchar(50)',
      notNull: true,
    },
    owner_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    avatar_url: {
      type: 'text',
    },
    emoji: {
      type: 'varchar(10)',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('groups', 'owner_id');

  // ============================================
  // GROUP MEMBERSHIPS TABLE
  // ============================================
  pgm.createTable('group_memberships', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    group_id: {
      type: 'uuid',
      notNull: true,
      references: 'groups',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    role: {
      type: 'varchar(20)',
      notNull: true,
      default: 'member', // 'owner', 'admin', 'member'
    },
    joined_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('group_memberships', 'unique_group_user', {
    unique: ['group_id', 'user_id'],
  });
  pgm.createIndex('group_memberships', 'group_id');
  pgm.createIndex('group_memberships', 'user_id');

  // ============================================
  // VENUES TABLE (with PostGIS geography)
  // ============================================
  pgm.createTable('venues', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    external_place_id: {
      type: 'varchar(255)', // Google Places or Foursquare ID
      unique: true,
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    address: {
      type: 'text',
    },
    city: {
      type: 'varchar(100)',
    },
    state: {
      type: 'varchar(50)',
    },
    zip_code: {
      type: 'varchar(20)',
    },
    location: {
      type: 'geography(POINT, 4326)', // PostGIS geography type for lat/lng
      notNull: true,
    },
    category: {
      type: 'varchar(50)',
      notNull: true, // 'bar', 'club', 'restaurant', 'lounge', 'brewery', 'rooftop'
    },
    subcategory: {
      type: 'varchar(50)', // 'sports_bar', 'dive_bar', 'cocktail_lounge', etc.
    },
    estimated_capacity: {
      type: 'integer',
    },
    metadata: {
      type: 'jsonb',
      default: '{}', // { website, phone, hours, photos, priceLevel }
    },
    is_verified: {
      type: 'boolean',
      default: false,
    },
    is_active: {
      type: 'boolean',
      default: true,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Spatial index for location queries
  pgm.sql('CREATE INDEX idx_venues_location ON venues USING GIST(location);');
  pgm.createIndex('venues', 'category');
  pgm.createIndex('venues', 'city');
  pgm.createIndex('venues', 'is_active');

  // ============================================
  // CROWD READINGS TABLE (aggregated crowd data)
  // ============================================
  pgm.createTable('crowd_readings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    venue_id: {
      type: 'uuid',
      notNull: true,
      references: 'venues',
      onDelete: 'CASCADE',
    },
    timestamp: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
    estimated_count: {
      type: 'integer',
      notNull: true,
    },
    capacity_percentage: {
      type: 'decimal(5,2)', // e.g., 75.50%
    },
    source: {
      type: 'varchar(30)',
      notNull: true, // 'user_pings', 'wifi_probe', 'venue_reported', 'inferred'
    },
    confidence: {
      type: 'varchar(10)',
      notNull: true,
      default: 'medium', // 'low', 'medium', 'high'
    },
    trend: {
      type: 'varchar(20)', // 'filling_up', 'steady', 'emptying'
    },
  });

  pgm.createIndex('crowd_readings', 'venue_id');
  pgm.createIndex('crowd_readings', 'timestamp');
  pgm.createIndex('crowd_readings', ['venue_id', 'timestamp']);

  // ============================================
  // USER PRESENCE TABLE (real-time location/status)
  // ============================================
  pgm.createTable('user_presence', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    venue_id: {
      type: 'uuid',
      references: 'venues',
      onDelete: 'SET NULL',
    },
    location: {
      type: 'geography(POINT, 4326)',
    },
    status: {
      type: 'varchar(30)',
      notNull: true, // 'going_out', 'at_venue', 'sharing_location', 'offline'
    },
    sharing_mode: {
      type: 'varchar(20)',
      notNull: true,
      default: 'none', // 'none', 'all_friends', 'groups', 'specific'
    },
    sharing_with: {
      type: 'jsonb',
      default: '[]', // Array of group_ids or user_ids depending on sharing_mode
    },
    started_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
    expires_at: {
      type: 'timestamp with time zone', // For ephemeral sharing
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('user_presence', 'user_id');
  pgm.createIndex('user_presence', 'venue_id');
  pgm.createIndex('user_presence', 'status');
  pgm.createIndex('user_presence', 'expires_at');
  pgm.sql('CREATE INDEX idx_user_presence_location ON user_presence USING GIST(location);');

  // ============================================
  // VENUE PINGS TABLE (invitations to venues)
  // ============================================
  pgm.createTable('venue_pings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    sender_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    venue_id: {
      type: 'uuid',
      notNull: true,
      references: 'venues',
      onDelete: 'CASCADE',
    },
    target_type: {
      type: 'varchar(20)',
      notNull: true, // 'group', 'individual', 'all_friends'
    },
    target_id: {
      type: 'uuid', // group_id or user_id (null if all_friends)
    },
    message: {
      type: 'varchar(280)',
    },
    sent_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
    expires_at: {
      type: 'timestamp with time zone',
    },
  });

  pgm.createIndex('venue_pings', 'sender_id');
  pgm.createIndex('venue_pings', 'venue_id');
  pgm.createIndex('venue_pings', 'target_type');
  pgm.createIndex('venue_pings', 'sent_at');

  // ============================================
  // PING RESPONSES TABLE
  // ============================================
  pgm.createTable('ping_responses', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    ping_id: {
      type: 'uuid',
      notNull: true,
      references: 'venue_pings',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    response: {
      type: 'varchar(10)',
      notNull: true, // 'in', 'out', 'maybe'
    },
    responded_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('ping_responses', 'unique_ping_user', {
    unique: ['ping_id', 'user_id'],
  });
  pgm.createIndex('ping_responses', 'ping_id');
  pgm.createIndex('ping_responses', 'user_id');

  // ============================================
  // OTP VERIFICATION TABLE
  // ============================================
  pgm.createTable('otp_codes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    phone: {
      type: 'varchar(20)',
      notNull: true,
    },
    code: {
      type: 'varchar(6)',
      notNull: true,
    },
    expires_at: {
      type: 'timestamp with time zone',
      notNull: true,
    },
    verified: {
      type: 'boolean',
      default: false,
    },
    attempts: {
      type: 'integer',
      default: 0,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('otp_codes', 'phone');
  pgm.createIndex('otp_codes', 'expires_at');

  // ============================================
  // REFRESH TOKENS TABLE
  // ============================================
  pgm.createTable('refresh_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    token_hash: {
      type: 'varchar(255)',
      notNull: true,
    },
    device_info: {
      type: 'jsonb',
    },
    expires_at: {
      type: 'timestamp with time zone',
      notNull: true,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('refresh_tokens', 'user_id');
  pgm.createIndex('refresh_tokens', 'token_hash');
  pgm.createIndex('refresh_tokens', 'expires_at');
};

exports.down = (pgm) => {
  pgm.dropTable('refresh_tokens');
  pgm.dropTable('otp_codes');
  pgm.dropTable('ping_responses');
  pgm.dropTable('venue_pings');
  pgm.dropTable('user_presence');
  pgm.dropTable('crowd_readings');
  pgm.dropTable('venues');
  pgm.dropTable('group_memberships');
  pgm.dropTable('groups');
  pgm.dropTable('friendships');
  pgm.dropTable('users');
  pgm.sql('DROP EXTENSION IF EXISTS postgis;');
  pgm.sql('DROP EXTENSION IF EXISTS "uuid-ossp";');
};
