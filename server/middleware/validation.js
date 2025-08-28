const { z } = require('zod');
const mongoSanitize = require('express-mongo-sanitize');

/**
 * Comprehensive validation middleware using Zod schemas
 * Provides input validation, sanitization, and security checks
 */

/**
 * Creates a validation middleware for the given Zod schema
 * @param {z.ZodSchema} schema - Zod validation schema
 * @param {string} source - Source of data ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const validate = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      // Get data from the specified source
      let data;
      switch (source) {
        case 'body':
          data = req.body;
          break;
        case 'query':
          data = req.query;
          break;
        case 'params':
          data = req.params;
          break;
        default:
          return res.status(500).json({
            error: 'Validation configuration error',
            message: 'Invalid validation source specified'
          });
      }

      // Sanitize data to prevent NoSQL injection
      const sanitizedData = mongoSanitize.sanitize(data);

      // Validate against schema
      const validatedData = await schema.parseAsync(sanitizedData);

      // Replace original data with validated and sanitized data
      req[source] = validatedData;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format Zod validation errors
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          error: 'Validation failed',
          message: 'The provided data is invalid',
          details: formattedErrors
        });
      }

      // Handle other validation errors
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        error: 'Validation error',
        message: 'An error occurred during validation'
      });
    }
  };
};

/**
 * Sanitization middleware to prevent various injection attacks
 */
const sanitize = (req, res, next) => {
  try {
    // Sanitize all request data
    if (req.body) {
      req.body = mongoSanitize.sanitize(req.body);
      // Additional XSS prevention for string fields
      req.body = sanitizeXSS(req.body);
    }
    
    if (req.query) {
      req.query = mongoSanitize.sanitize(req.query);
      req.query = sanitizeXSS(req.query);
    }
    
    if (req.params) {
      req.params = mongoSanitize.sanitize(req.params);
      req.params = sanitizeXSS(req.params);
    }

    next();
  } catch (error) {
    console.error('Sanitization error:', error);
    return res.status(500).json({
      error: 'Data processing error',
      message: 'An error occurred while processing your request'
    });
  }
};

/**
 * Recursively sanitize object to prevent XSS
 * @param {any} obj - Object to sanitize
 * @returns {any} Sanitized object
 */
function sanitizeXSS(obj) {
  if (typeof obj === 'string') {
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeXSS);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeXSS(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * File upload validation middleware
 * @param {Object} options - Validation options
 * @param {string[]} options.allowedTypes - Allowed MIME types
 * @param {number} options.maxSize - Maximum file size in bytes
 * @returns {Function} Express middleware function
 */
const validateFileUpload = (options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
    maxSize = 5 * 1024 * 1024 // 5MB default
  } = options;

  return (req, res, next) => {
    if (!req.file) {
      return next();
    }

    // Check file type
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: `Allowed types: ${allowedTypes.join(', ')}`
      });
    }

    // Check file size
    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: 'File too large',
        message: `Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
      });
    }

    // Additional security checks
    const filename = req.file.originalname.toLowerCase();
    const dangerousExtensions = ['.php', '.exe', '.bat', '.sh', '.cmd', '.scr'];
    
    if (dangerousExtensions.some(ext => filename.endsWith(ext))) {
      return res.status(400).json({
        error: 'Dangerous file type',
        message: 'This file type is not allowed for security reasons'
      });
    }

    next();
  };
};

/**
 * Rate limiting validation - checks if request is within rate limits
 * This middleware should be used after rate limiting middleware
 */
const validateRateLimit = (req, res, next) => {
  // Check if rate limit headers are present (set by rate limiting middleware)
  const remaining = req.get('X-RateLimit-Remaining');
  const reset = req.get('X-RateLimit-Reset');

  if (remaining !== undefined && parseInt(remaining) <= 5) {
    // Warn when approaching rate limit
    res.set('X-RateLimit-Warning', 'Approaching rate limit');
  }

  next();
};

/**
 * Custom validation for MongoDB ObjectIds
 */
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        error: 'Invalid ID format',
        message: `${paramName} must be a valid ObjectId`
      });
    }

    next();
  };
};

/**
 * Pagination validation middleware
 */
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 10, sort } = req.query;

  // Validate page number
  const pageNum = parseInt(page);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > 1000) {
    return res.status(400).json({
      error: 'Invalid pagination',
      message: 'Page must be a number between 1 and 1000'
    });
  }

  // Validate limit
  const limitNum = parseInt(limit);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      error: 'Invalid pagination',
      message: 'Limit must be a number between 1 and 100'
    });
  }

  // Validate sort parameter
  if (sort && !/^[a-zA-Z_][\w]*$/.test(sort.replace(/^-/, ''))) {
    return res.status(400).json({
      error: 'Invalid sort parameter',
      message: 'Sort field contains invalid characters'
    });
  }

  // Add validated pagination to request
  req.pagination = {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
    sort: sort || '-createdAt'
  };

  next();
};

/**
 * CSRF token validation for state-changing operations
 */
const validateCSRF = (req, res, next) => {
  // Skip CSRF validation for API requests with proper authentication
  if (req.get('Authorization') && req.get('Content-Type') === 'application/json') {
    return next();
  }

  // Check for CSRF token in header or body
  const token = req.get('X-CSRF-Token') || req.body._csrf;
  
  if (!token) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'CSRF token is required for this operation'
    });
  }

  // Validate CSRF token format
  if (!/^[a-zA-Z0-9\-._]{20,}$/.test(token)) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token format is invalid'
    });
  }

  next();
};

module.exports = {
  validate,
  sanitize,
  validateFileUpload,
  validateRateLimit,
  validateObjectId,
  validatePagination,
  validateCSRF,
  sanitizeXSS
};
