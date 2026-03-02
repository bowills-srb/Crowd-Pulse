require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const { testConnection, connectRedis } = require('./config/database');
const { initializeSocket } = require('./services/socketService');
const {
  authRoutes,
  usersRoutes,
  venuesRoutes,
  friendsRoutes,
  groupsRoutes,
  presenceRoutes,
  pingsRoutes,
} = require('./routes');
const b2bRoutes = require('./routes/b2b');
const { createWebhookRouter } = require('./services/geofenceService');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Initialize socket handlers
initializeSocket(io);

// Make io accessible in routes if needed
app.set('io', io);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/venues', venuesRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/pings', pingsRoutes);
app.use('/api/b2b', b2bRoutes);
app.use('/webhooks', createWebhookRouter());

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { message: err.message }),
  });
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database');
      process.exit(1);
    }

    // Connect to Redis
    await connectRedis();

    // Start listening
    server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🎉 CrowdPulse API Server                        ║
║                                                   ║
║   Port: ${PORT}                                      ║
║   Environment: ${process.env.NODE_ENV || 'development'}                    ║
║                                                   ║
║   Endpoints:                                      ║
║   • POST /api/auth/send-code                      ║
║   • POST /api/auth/verify                         ║
║   • GET  /api/venues/nearby                       ║
║   • GET  /api/presence/friends                    ║
║   • POST /api/pings                               ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };
