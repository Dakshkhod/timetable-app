const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// Brute force protection disabled for development
// const ExpressBrute = require('express-brute');
// const ExpressBruteMongoStore = require('express-brute-mongo');
const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Comprehensive security middleware for OWASP ASVS Level 2 compliance
 * Implements defense-in-depth security controls
 */

/**
 * Configure Helmet for security headers
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for React development
        "https://apis.google.com",
        "https://www.gstatic.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Tailwind CSS
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "blob:"
      ],
      connectSrc: [
        "'self'",
        "https://api.openai.com",
        "https://classroom.googleapis.com",
        process.env.SENTRY_DSN ? "https://sentry.io" : ""
      ].filter(Boolean),
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      reportUri: process.env.CSP_REPORT_URI || null
    },
    reportOnly: process.env.NODE_ENV === 'development'
  },
  hsts: false, // Disable HSTS in development to prevent SSL issues
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

/**
 * General rate limiting
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/api/healthz';
  },
  keyGenerator: (req) => {
    // Use IP + User-Agent for more granular rate limiting
    return `${req.ip}-${crypto.createHash('sha256').update(req.get('User-Agent') || '').digest('hex').substring(0, 8)}`;
  }
});

/**
 * Strict rate limiting for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS) || 100, // Increased for development
  message: {
    error: 'Too many authentication attempts',
    message: 'Account temporarily locked. Please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // Rate limit by IP + email combination for auth endpoints
    const email = req.body?.email || 'unknown';
    return `${req.ip}-${crypto.createHash('sha256').update(email).digest('hex').substring(0, 8)}`;
  }
});

/**
 * Brute force protection for login attempts
 */
// Brute force protection disabled for development
// let bruteStore;
// try {
//   if (mongoose.connection.readyState === 1) {
//     bruteStore = new ExpressBruteMongoStore(() => mongoose.connection.db.collection('bruteforce'));
//   }
// } catch (error) {
//   console.warn('MongoDB not available for brute force protection, using memory store');
// }

// const bruteForce = new ExpressBrute(bruteStore, {
//   freeRetries: 3,
//   minWait: 5 * 60 * 1000, // 5 minutes
//   maxWait: 60 * 60 * 1000, // 1 hour
//   lifetime: 24 * 60 * 60, // 1 day
//   failCallback: (req, res, next, nextValidRequestDate) => {
//     res.status(429).json({
//       error: 'Account temporarily locked',
//       message: 'Too many failed login attempts. Please try again later.',
//       nextValidRequestDate: nextValidRequestDate
//     });
//   },
//   handleStoreError: (error) => {
//     console.error('Brute force store error:', error);
//     // Continue without brute force protection if store fails
//     return false;
//   }
// });

/**
 * Advanced IP filtering and geo-blocking
 */
const ipFilter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  // Block private IP ranges from external access (except in development)
  if (process.env.NODE_ENV === 'production') {
    const privateRanges = [
      /^10\./,
      /^172\.1[6-9]\./,
      /^172\.2[0-9]\./,
      /^172\.3[0-1]\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];

    if (privateRanges.some(range => range.test(ip))) {
      console.warn(`Blocked private IP access: ${ip}`);
      return res.status(403).json({
        error: 'Access denied',
        message: 'Access from private IP ranges is not allowed'
      });
    }
  }

  // Check for suspicious headers
  const suspiciousHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-cluster-client-ip'
  ];

  let actualIP = ip;
  for (const header of suspiciousHeaders) {
    const headerValue = req.get(header);
    if (headerValue) {
      // Use the rightmost IP in chain (closest to server)
      const ips = headerValue.split(',').map(ip => ip.trim());
      actualIP = ips[ips.length - 1];
      break;
    }
  }

  req.realIP = actualIP;
  next();
};

/**
 * Request size limitation
 */
const requestSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.get('Content-Length') || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    return res.status(413).json({
      error: 'Request too large',
      message: `Request size exceeds ${maxSize / 1024 / 1024}MB limit`
    });
  }

  next();
};

/**
 * User-Agent validation
 */
const validateUserAgent = (req, res, next) => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent) {
    return res.status(400).json({
      error: 'Missing User-Agent',
      message: 'User-Agent header is required'
    });
  }

  // Block known malicious user agents
  const blockedPatterns = [
    /sqlmap/i,
    /nmap/i,
    /nikto/i,
    /masscan/i,
    /zap/i,
    /burp/i,
    /bot.*bot/i // Aggressive bot patterns
  ];

  if (blockedPatterns.some(pattern => pattern.test(userAgent))) {
    console.warn(`Blocked suspicious User-Agent: ${userAgent} from IP: ${req.ip}`);
    return res.status(403).json({
      error: 'Access denied',
      message: 'Suspicious user agent detected'
    });
  }

  next();
};

/**
 * Request method validation
 */
const validateHttpMethod = (req, res, next) => {
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
  
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed',
      message: `HTTP method ${req.method} is not allowed`
    });
  }

  next();
};

/**
 * Timing attack protection
 */
const timingAttackProtection = (req, res, next) => {
  // Add random delay to prevent timing attacks (for sensitive endpoints)
  if (req.path.includes('login') || req.path.includes('auth')) {
    const delay = Math.floor(Math.random() * 100) + 50; // 50-150ms random delay
    setTimeout(next, delay);
  } else {
    next();
  }
};

/**
 * Security event logging
 */
const securityLogger = (req, res, next) => {
  // Log security-relevant events
  const securityEvents = [
    'login',
    'register', 
    'password-reset',
    'admin',
    'delete'
  ];

  const isSecurityEvent = securityEvents.some(event => req.path.includes(event));
  
  if (isSecurityEvent) {
    console.log(`Security Event: ${req.method} ${req.path} from ${req.realIP || req.ip} - User-Agent: ${req.get('User-Agent')}`);
  }

  next();
};

/**
 * CORS configuration with strict security
 */
const corsConfig = {
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000')
      .split(',')
      .map(url => url.trim());

    // Allow requests with no origin (mobile apps, curl, Postman). Axios from React Native sends no Origin header.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from origin: ${origin}`);
      callback(new Error('CORS: Origin not allowed'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400 // 24 hours
};

module.exports = {
  helmetConfig,
  generalLimiter,
  authLimiter,

  ipFilter,
  requestSizeLimit,
  validateUserAgent,
  validateHttpMethod,
  timingAttackProtection,
  securityLogger,
  corsConfig
};
