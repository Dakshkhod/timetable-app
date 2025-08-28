const { z } = require('zod');

/**
 * Authentication validation schemas using Zod
 * These schemas provide comprehensive input validation for auth endpoints
 */

// Common validation patterns
const emailSchema = z.string()
  .email('Invalid email format')
  .max(254, 'Email too long')
  .trim()
  .toLowerCase();

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    'Password must contain uppercase, lowercase, number, and special character');

const nameSchema = z.string()
  .min(1, 'Name is required')
  .max(100, 'Name too long')
  .trim()
  .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters');

// Registration schema
const registerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  branch: z.enum(['CSE', 'ECE', 'ME', 'CE', 'EE', 'IT', 'Other'], {
    errorMap: () => ({ message: 'Invalid branch selection' })
  }),
  year: z.enum(['1', '2', '3', '4'], {
    errorMap: () => ({ message: 'Invalid year selection' })
  }),
  rollNumber: z.string()
    .min(1, 'Roll number is required')
    .max(20, 'Roll number too long')
    .trim()
    .regex(/^[A-Za-z0-9-]+$/, 'Roll number contains invalid characters'),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and conditions'
  })
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

// Login schema
const loginSchema = z.object({
  email: emailSchema,
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password too long'),
  rememberMe: z.boolean().optional()
});

// Password reset request schema
const passwordResetRequestSchema = z.object({
  email: emailSchema
});

// Password reset schema
const passwordResetSchema = z.object({
  token: z.string()
    .min(1, 'Reset token is required')
    .max(500, 'Invalid token'),
  password: passwordSchema,
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

// Profile update schema
const profileUpdateSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  branch: z.enum(['CSE', 'ECE', 'ME', 'CE', 'EE', 'IT', 'Other']).optional(),
  year: z.enum(['1', '2', '3', '4']).optional(),
  rollNumber: z.string()
    .max(20, 'Roll number too long')
    .trim()
    .regex(/^[A-Za-z0-9-]*$/, 'Roll number contains invalid characters')
    .optional(),
  bio: z.string()
    .max(500, 'Bio too long')
    .trim()
    .optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    notifications: z.object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      assignments: z.boolean().optional(),
      reminders: z.boolean().optional()
    }).optional(),
    timetable: z.object({
      defaultView: z.enum(['daily', 'weekly', 'monthly']).optional(),
      showWeekends: z.boolean().optional(),
      timeFormat: z.enum(['12h', '24h']).optional()
    }).optional()
  }).optional()
});

// Change password schema
const changePasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmNewPassword: z.string()
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'New passwords do not match',
  path: ['confirmNewPassword']
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword']
});

// JWT token validation schema
const tokenSchema = z.object({
  token: z.string()
    .min(1, 'Token is required')
    .regex(/^[A-Za-z0-9\-_.]+$/, 'Invalid token format')
});

module.exports = {
  registerSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  profileUpdateSchema,
  changePasswordSchema,
  tokenSchema,
  // Export sub-schemas for reuse
  emailSchema,
  passwordSchema,
  nameSchema
};
