const { z } = require('zod');

/**
 * Timetable validation schemas using Zod
 * These schemas provide comprehensive input validation for timetable endpoints
 */

// Time format validation (24-hour format HH:MM)
const timeSchema = z.string()
  .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (use HH:MM)')
  .refine(time => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours >= 6 && hours <= 23; // Classes between 6 AM and 11 PM
  }, 'Class time must be between 06:00 and 23:00');

// Day of week validation
const daySchema = z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], {
  errorMap: () => ({ message: 'Invalid day of week' })
});

// Subject/course validation
const subjectSchema = z.string()
  .min(1, 'Subject name is required')
  .max(100, 'Subject name too long')
  .trim()
  .regex(/^[a-zA-Z0-9\s\-&().,]+$/, 'Subject name contains invalid characters');

// Teacher name validation
const teacherSchema = z.string()
  .min(1, 'Teacher name is required')
  .max(100, 'Teacher name too long')
  .trim()
  .regex(/^[a-zA-Z\s.'-]+$/, 'Teacher name contains invalid characters');

// Room/location validation
const roomSchema = z.string()
  .min(1, 'Room is required')
  .max(50, 'Room name too long')
  .trim()
  .regex(/^[a-zA-Z0-9\s\-#]+$/, 'Room name contains invalid characters');

// Class type validation
const classTypeSchema = z.enum(['Lecture', 'Lab', 'Tutorial', 'Seminar', 'Workshop', 'Exam', 'Other'], {
  errorMap: () => ({ message: 'Invalid class type' })
});

// Color validation for UI
const colorSchema = z.string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format (use hex #RRGGBB)')
  .optional()
  .default('#3B82F6');

// Branch validation
const branchSchema = z.enum(['CSE', 'ECE', 'ME', 'CE', 'EE', 'IT', 'Other'], {
  errorMap: () => ({ message: 'Invalid branch' })
});

// Year validation
const yearSchema = z.enum(['1', '2', '3', '4'], {
  errorMap: () => ({ message: 'Invalid year' })
});

// Custom class creation schema
const createCustomClassSchema = z.object({
  subject: subjectSchema,
  teacher: teacherSchema.optional(),
  room: roomSchema,
  day: daySchema,
  startTime: timeSchema,
  endTime: timeSchema,
  classType: classTypeSchema,
  color: colorSchema,
  notes: z.string()
    .max(500, 'Notes too long')
    .trim()
    .optional(),
  isRecurring: z.boolean().default(true),
  recurringEndDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)')
    .optional()
}).refine(data => {
  const start = data.startTime.split(':').map(Number);
  const end = data.endTime.split(':').map(Number);
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  return endMinutes > startMinutes;
}, {
  message: 'End time must be after start time',
  path: ['endTime']
}).refine(data => {
  const start = data.startTime.split(':').map(Number);
  const end = data.endTime.split(':').map(Number);
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  const duration = endMinutes - startMinutes;
  return duration >= 30 && duration <= 240; // 30 min to 4 hours
}, {
  message: 'Class duration must be between 30 minutes and 4 hours',
  path: ['endTime']
});

// Update custom class schema
const updateCustomClassSchema = createCustomClassSchema.partial().extend({
  id: z.string()
    .min(1, 'Class ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid class ID format')
});

// Timetable preferences schema
const timetablePreferencesSchema = z.object({
  defaultView: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  timeFormat: z.enum(['12h', '24h']).default('24h'),
  showWeekends: z.boolean().default(false),
  startHour: z.number().int().min(0).max(23).default(6),
  endHour: z.number().int().min(0).max(23).default(22),
  theme: z.object({
    primaryColor: colorSchema,
    backgroundColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
    textColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional()
  }).optional(),
  notifications: z.object({
    beforeClass: z.number().int().min(0).max(60).default(10), // minutes
    showPopups: z.boolean().default(true),
    soundEnabled: z.boolean().default(false)
  }).optional()
}).refine(data => data.endHour > data.startHour, {
  message: 'End hour must be after start hour',
  path: ['endHour']
});

// Class visibility toggle schema
const toggleClassVisibilitySchema = z.object({
  classId: z.string()
    .min(1, 'Class ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid class ID format'),
  isVisible: z.boolean()
});

// Timetable query parameters schema
const timetableQuerySchema = z.object({
  branch: branchSchema,
  year: yearSchema,
  day: daySchema.optional(),
  view: z.enum(['daily', 'weekly', 'monthly']).optional(),
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)')
    .optional(),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)')
    .optional()
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate']
});

// Bulk class operations schema
const bulkClassOperationSchema = z.object({
  operation: z.enum(['delete', 'hide', 'show', 'move']),
  classIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/))
    .min(1, 'At least one class ID is required')
    .max(50, 'Too many classes selected'),
  targetDay: daySchema.optional(), // For move operation
  targetTime: timeSchema.optional() // For move operation
}).refine(data => {
  if (data.operation === 'move') {
    return data.targetDay && data.targetTime;
  }
  return true;
}, {
  message: 'Target day and time required for move operation',
  path: ['targetDay']
});

// Free slots query schema
const freeSlotsQuerySchema = z.object({
  branch: branchSchema,
  year: yearSchema,
  day: daySchema,
  minDuration: z.number().int().min(15).max(480).default(30), // minutes
  excludeBreaks: z.boolean().default(false)
});

module.exports = {
  createCustomClassSchema,
  updateCustomClassSchema,
  timetablePreferencesSchema,
  toggleClassVisibilitySchema,
  timetableQuerySchema,
  bulkClassOperationSchema,
  freeSlotsQuerySchema,
  // Export sub-schemas for reuse
  timeSchema,
  daySchema,
  subjectSchema,
  teacherSchema,
  roomSchema,
  classTypeSchema,
  colorSchema,
  branchSchema,
  yearSchema
};
