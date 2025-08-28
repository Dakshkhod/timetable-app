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
  }
});

const classSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  subjectCode: {
    type: String,
    required: [true, 'Subject code is required'],
    trim: true
  },
  teacher: {
    type: String,
    required: [true, 'Teacher name is required'],
    trim: true
  },
  room: {
    type: String,
    required: [true, 'Room number is required'],
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
    default: '#3B82F6' // Default blue color
  }
});

const timetableSchema = new mongoose.Schema({
  branch: {
    type: String,
    required: [true, 'Branch is required'],
    enum: ['Computer Science', 'Mechanical', 'Electrical', 'Civil', 'Chemical', 'Electronics', 'Material and Metallurgical Engineering']
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: 1,
    max: 4
  },
  semester: {
    type: Number,
    required: [true, 'Semester is required'],
    min: 1,
    max: 8
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true
  },
  classes: [classSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
timetableSchema.index({ branch: 1, year: 1, semester: 1, academicYear: 1 });

// Method to get classes for a specific day
timetableSchema.methods.getClassesForDay = function(day) {
  return this.classes.filter(cls => cls.day === day);
};

// Method to get classes for a specific time
timetableSchema.methods.getClassesForTime = function(time, day) {
  return this.classes.filter(cls => 
    cls.day === day && 
    cls.timeSlot.startTime <= time && 
    cls.timeSlot.endTime > time
  );
};

// Method to get free slots for a day
timetableSchema.methods.getFreeSlots = function(day) {
  const dayClasses = this.getClassesForDay(day);
  const freeSlots = [];
  
  // Define working hours (8 AM to 6 PM)
  const workingHours = [
    { start: '08:00', end: '09:00' },
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '12:00', end: '13:00' },
    { start: '13:00', end: '14:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' },
    { start: '17:00', end: '18:00' }
  ];

  workingHours.forEach(slot => {
    const hasClass = dayClasses.some(cls => 
      cls.timeSlot.startTime <= slot.start && 
      cls.timeSlot.endTime > slot.start
    );
    
    if (!hasClass) {
      freeSlots.push(slot);
    }
  });

  return freeSlots;
};

module.exports = mongoose.model('Timetable', timetableSchema); 