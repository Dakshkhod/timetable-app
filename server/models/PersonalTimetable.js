const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  startTime: {
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
  },
  endTime: {
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
  },
  // New field to track which time periods this class occupies
  occupiedSlots: [{
    startTime: String,
    endTime: String
  }]
});

const classSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  subjectCode: {
    type: String,
    trim: true
  },
  teacher: {
    type: String,
    trim: true
  },
  room: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['Lecture', 'Tutorial', 'Lab', 'Seminar', 'Project'],
    default: 'Lecture'
  },
  timeSlot: {
    type: timeSlotSchema,
    required: true
  },
  day: {
    type: String,
    required: [true, 'Day is required'],
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  },
  weekType: {
    type: String,
    enum: ['All', 'Odd', 'Even'],
    default: 'All'
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  // New field to indicate if this class spans multiple time periods
  isMultiSlot: {
    type: Boolean,
    default: false
  },
  // Duration in minutes
  duration: {
    type: Number,
    default: 50
  }
});

const personalTimetableSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  branch: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  semester: {
    type: Number,
    default: 1
  },
  academicYear: {
    type: String,
    default: '2024-25'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  classes: [classSchema],
  preferences: {
    defaultColor: { type: String, default: '#3B82F6' },
    showWeekends: { type: Boolean, default: false },
    timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' },
    // New preference for default slot duration
    defaultSlotDuration: { type: Number, default: 50 }
  }
}, {
  timestamps: true
});

// Index for efficient queries
personalTimetableSchema.index({ userId: 1 });

// Helper function to calculate duration between two times
function calculateDuration(startTime, endTime) {
  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  return Math.round((end - start) / (1000 * 60)); // Duration in minutes
}

// Helper function to get occupied time slots
function getOccupiedSlots(startTime, endTime) {
  const slots = [];
  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  
  // Generate 50-minute slots from start to end
  let current = new Date(start);
  while (current < end) {
    const slotStart = current.toTimeString().slice(0, 5);
    current.setMinutes(current.getMinutes() + 50);
    const slotEnd = current.toTimeString().slice(0, 5);
    
    if (current <= end) {
      slots.push({ startTime: slotStart, endTime: slotEnd });
    }
  }
  
  return slots;
}

// Method to add a new class with flexible time slots
personalTimetableSchema.methods.addClass = function(classData) {
  const newClass = {
    ...classData,
    _id: new mongoose.Types.ObjectId()
  };
  
  // Calculate duration and check if it's multi-slot
  const duration = calculateDuration(classData.timeSlot.startTime, classData.timeSlot.endTime);
  newClass.duration = duration;
  newClass.isMultiSlot = duration > 50;
  
  // Generate occupied slots for multi-slot classes
  if (newClass.isMultiSlot) {
    newClass.timeSlot.occupiedSlots = getOccupiedSlots(classData.timeSlot.startTime, classData.timeSlot.endTime);
  } else {
    newClass.timeSlot.occupiedSlots = [{
      startTime: classData.timeSlot.startTime,
      endTime: classData.timeSlot.endTime
    }];
  }
  
  this.classes.push(newClass);
  return newClass;
};

// Method to update a class
personalTimetableSchema.methods.updateClass = function(classId, updates) {
  const classIndex = this.classes.findIndex(cls => cls._id.toString() === classId);
  if (classIndex === -1) return null;
  
  // If time slot is being updated, recalculate duration and occupied slots
  if (updates.timeSlot) {
    const duration = calculateDuration(updates.timeSlot.startTime, updates.timeSlot.endTime);
    updates.duration = duration;
    updates.isMultiSlot = duration > 50;
    
    if (updates.isMultiSlot) {
      updates.timeSlot.occupiedSlots = getOccupiedSlots(updates.timeSlot.startTime, updates.timeSlot.endTime);
    } else {
      updates.timeSlot.occupiedSlots = [{
        startTime: updates.timeSlot.startTime,
        endTime: updates.timeSlot.endTime
      }];
    }
  }
  
  this.classes[classIndex] = { ...this.classes[classIndex], ...updates };
  return this.classes[classIndex];
};

// Method to remove a class
personalTimetableSchema.methods.removeClass = function(classId) {
  this.classes = this.classes.filter(cls => cls._id.toString() !== classId);
  return true;
};

// Method to get classes for a specific day
personalTimetableSchema.methods.getClassesForDay = function(day) {
  return this.classes.filter(cls => cls.day === day);
};

// Method to get sorted classes (by day and time)
personalTimetableSchema.methods.getSortedClasses = function() {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return [...this.classes].sort((a, b) => {
    const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
  });
};

// Method to check if a time slot is available
personalTimetableSchema.methods.isTimeSlotAvailable = function(day, startTime, endTime, excludeClassId = null) {
  const dayClasses = this.getClassesForDay(day);
  
  for (const cls of dayClasses) {
    if (excludeClassId && cls._id.toString() === excludeClassId) continue;
    
    // Use simple, direct time overlap check (same as frontend)
    const existingStart = cls.timeSlot.startTime;
    const existingEnd = cls.timeSlot.endTime;
    
    // Check if the new time slot overlaps with existing ones
    const hasConflict = (
      (startTime >= existingStart && startTime < existingEnd) ||
      (endTime > existingStart && endTime <= existingEnd) ||
      (startTime <= existingStart && endTime >= existingEnd)
    );
    
    if (hasConflict) {
      console.log(`🚨 Time conflict detected: ${startTime}-${endTime} conflicts with ${existingStart}-${existingEnd} (${cls.subject})`);
      return false;
    }
  }
  
  return true;
};

// Helper method to check if two time slots overlap
personalTimetableSchema.methods.slotsOverlap = function(slot1, slot2) {
  const start1 = new Date(`2000-01-01 ${slot1.startTime}`);
  const end1 = new Date(`2000-01-01 ${slot1.endTime}`);
  const start2 = new Date(`2000-01-01 ${slot2.startTime}`);
  const end2 = new Date(`2000-01-01 ${slot2.endTime}`);
  
  return start1 < end2 && start2 < end1;
};

// Method to get available time slots for a day
personalTimetableSchema.methods.getAvailableTimeSlots = function(day, startHour = 8, endHour = 18) {
  const occupiedSlots = [];
  const dayClasses = this.getClassesForDay(day);
  
  // Collect all occupied slots
  for (const cls of dayClasses) {
    occupiedSlots.push(...cls.timeSlot.occupiedSlots);
  }
  
  // Generate all possible 50-minute slots
  const allSlots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 50) {
      const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const endTime = minute === 10 ? `${hour + 1}:00` : `${hour}:${(minute + 50).toString().padStart(2, '0')}`;
      
      allSlots.push({ startTime, endTime });
    }
  }
  
  // Filter out occupied slots
  return allSlots.filter(slot => {
    return !occupiedSlots.some(occupied => this.slotsOverlap(slot, occupied));
  });
};

module.exports = mongoose.model('PersonalTimetable', personalTimetableSchema);
