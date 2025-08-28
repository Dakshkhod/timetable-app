const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const winston = require('winston');
const connectDB = require('./config/database');

// Production environment setup
// Force disable SSL certificate validation for Railway deployment
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Import security middleware
const {
  helmetConfig,
  generalLimiter,
  authLimiter,
  bruteForce,
  ipFilter,
  requestSizeLimit,
  validateUserAgent,
  validateHttpMethod,
  timingAttackProtection,
  securityLogger,
  corsConfig
} = require('./middleware/security');

const { sanitize } = require('./middleware/validation');

require('dotenv').config();

// Initialize Sentry for error tracking
if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0
  });
}

const app = express();
const PORT = process.env.PORT || 5000;

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'timetable-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Trust proxy for rate limiting and real IP detection
app.set('trust proxy', 1);

// Disable X-Powered-By header
app.disable('x-powered-by');

// Early security middleware
app.use(validateHttpMethod);
app.use(ipFilter);
app.use(validateUserAgent);
app.use(requestSizeLimit);

// Compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024
}));

// Security headers
app.use(helmetConfig);

// CORS configuration
app.use(cors(corsConfig));

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Smart Timetable Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Security event logging
app.use(securityLogger);

// Rate limiting
app.use('/api/auth', authLimiter);
app.use(generalLimiter);

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '1mb',
  type: ['application/json', 'application/*+json']
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '1mb',
  parameterLimit: 50
}));

// MongoDB injection protection
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`MongoDB injection attempt detected: ${key} from ${req.ip}`);
  }
}));

// HTTP Parameter Pollution protection
app.use(hpp({
  whitelist: ['tags', 'categories'] // Allow arrays for specific parameters
}));

// Input sanitization
app.use(sanitize);

// Session configuration for CSRF protection
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  name: 'sessionId',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: false, // Force false to prevent SSL issues
    httpOnly: true,
    maxAge: 15 * 60 * 1000, // 15 minutes
    sameSite: 'lax' // Changed from 'strict' to prevent issues
  },
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600, // lazy session update
    crypto: {
      secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production'
    }
  })
}));

// Timing attack protection for auth routes
app.use('/api/auth', timingAttackProtection);

// Brute force protection for login
app.use('/api/auth/login', bruteForce.prevent);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/timetable', require('./routes/timetable'));
app.use('/api/user-timetable', require('./routes/userTimetable'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/google', require('./routes/googleAuth'));
app.use('/api/planner', require('./routes/planner'));

// Health check endpoints
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    message: 'Smart Timetable API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.API_VERSION || 'v1'
  };

  // Verify secret for detailed health check
  if (req.query.secret === process.env.HEALTH_CHECK_SECRET) {
    healthCheck.detailed = {
      memory: process.memoryUsage(),
      database: 'Connected', // TODO: Add actual DB health check
      loadAverage: require('os').loadavg()
    };
  }

  res.json(healthCheck);
});

app.get('/api/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Readiness probe
app.get('/api/ready', async (req, res) => {
  try {
    // Check database connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not ready');
    }
    
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Sentry error handler (must be before other error handlers)
if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  app.use(Sentry.Handlers.errorHandler());
}

// Global error handling middleware
app.use((err, req, res, next) => {
  // Generate correlation ID for error tracking
  const correlationId = require('crypto').randomUUID();
  
  // Log error with correlation ID
  logger.error(`Error ${correlationId}:`, {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.realIP || req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId
  });

  // Security: Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  let statusCode = err.statusCode || err.status || 500;
  let message = 'Internal server error';
  
  if (statusCode < 500) {
    // Client errors - safe to expose message
    message = err.message;
  } else if (isDevelopment) {
    // Development - expose detailed errors
    message = err.message;
  }

  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message,
    correlationId,
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler with security considerations
app.use('*', (req, res) => {
  // Log potential scanning attempts
  if (req.path.includes('admin') || req.path.includes('wp-') || req.path.includes('.php')) {
    logger.warn(`Potential scanning attempt: ${req.method} ${req.path} from ${req.realIP || req.ip}`);
  }

  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const path = require('path');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    try {
      // Close database connections
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      
      // Close Winston logger
      logger.end();
      
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  // Force exit after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Connect to database and start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed:', error);
    if (process.env.NODE_ENV === 'production') {
      // In production, exit if database is not available
      console.error('💥 Cannot start server without database in production');
      process.exit(1);
    } else {
      console.log('⚠️  Database connection failed, but server will continue in development mode...');
    }
  }
  
  // Start server
  const server = app.listen(PORT, () => {
    const startupInfo = {
      message: 'Smart Timetable Server started successfully',
      port: PORT,
      environment: process.env.NODE_ENV,
      apiVersion: process.env.API_VERSION || 'v1',
      timestamp: new Date().toISOString(),
      endpoints: {
        api: `http://localhost:${PORT}/api`,
        health: `http://localhost:${PORT}/api/health`,
        frontend: 'http://localhost:3000'
      }
    };

    logger.info('Server startup', startupInfo);
    
    console.log(`🚀 Smart Timetable Server running on port ${PORT}`);
    console.log(`📱 API available at http://localhost:${PORT}/api`);
    console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
    console.log(`🌐 Frontend available at http://localhost:3000`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('');
      console.log('💡 Development mode features:');
      console.log('   • Detailed error messages');
      console.log('   • CORS relaxed for localhost');
      console.log('   • Server runs without database');
    }
  });

  // Setup graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  });

  return server;
};

// Add global variable for server instance
let server;

startServer().then(serverInstance => {
  server = serverInstance;
}).catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
}); 