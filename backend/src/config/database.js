const pgp = require('pg-promise')();
const redis = require('redis');

// PostgreSQL configuration
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'crowdpulse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20, // connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Initialize pg-promise with PostGIS support
const initOptions = {
  // Extend with PostGIS types
  receive(data, result, e) {
    // Can be used to transform query results
  },
  error(err, e) {
    console.error('Database error:', err.message || err);
  },
};

const db = pgp(pgConfig);

// Redis configuration for real-time presence and caching
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

// Connect to Redis
const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
};

// Test database connection
const testConnection = async () => {
  try {
    const result = await db.one('SELECT NOW() as now, PostGIS_Version() as postgis');
    console.log(`Database connected at ${result.now}`);
    console.log(`PostGIS version: ${result.postgis}`);
    return true;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    return false;
  }
};

module.exports = {
  db,
  pgp,
  redisClient,
  connectRedis,
  testConnection,
};
