const mongoose = require('mongoose');

const userTimeSlotSchema = new mongoose.Schema({
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

const userClassSchema = new mongoose.Schema({
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
    type: userTimeSlotSchema,
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
  isCustom: {
    type: Boolean,
    default: false
  },
  originalClassId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Timetable.classes'
  }
});

const userTimetableSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  baseTimetableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Timetable',
    required: true
  },
  customClasses: [userClassSchema],
  hiddenClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Timetable.classes'
  }],
  preferences: {
    showCustomClasses: { type: Boolean, default: true },
    showHiddenClasses: { type: Boolean, default: false },
    defaultColor: { type: String, default: '#3B82F6' }
  }
}, {
  timestamps: true
});

// Index for efficient queries
userTimetableSchema.index({ userId: 1, baseTimetableId: 1 });

// Method to get combined timetable (base + custom)
userTimetableSchema.methods.getCombinedTimetable = async function() {
  const baseTimetable = await mongoose.model('Timetable').findById(this.baseTimetableId);
  if (!baseTimetable) return null;

  // Start with base classes, excluding hidden ones
  const combinedClasses = baseTimetable.classes.filter(cls => 
    !this.hiddenClasses.includes(cls._id)
  );

  // Add custom classes
  combinedClasses.push(...this.customClasses);

  // Sort by day and time
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  combinedClasses.sort((a, b) => {
    const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
  });

  return {
    ...baseTimetable.toObject(),
    classes: combinedClasses,
    customClasses: this.customClasses,
    hiddenClasses: this.hiddenClasses,
    preferences: this.preferences
  };
};

// Method to add custom class
userTimetableSchema.methods.addCustomClass = function(classData) {
  const newClass = {
    ...classData,
    isCustom: true,
    _id: new mongoose.Types.ObjectId()
  };
  this.customClasses.push(newClass);
  return newClass;
};

// Method to update custom class
userTimetableSchema.methods.updateCustomClass = function(classId, updates) {
  const classIndex = this.customClasses.findIndex(cls => cls._id.toString() === classId);
  if (classIndex === -1) return null;
  
  this.customClasses[classIndex] = { ...this.customClasses[classIndex], ...updates };
  return this.customClasses[classIndex];
};

// Method to remove custom class
userTimetableSchema.methods.removeCustomClass = function(classId) {
  this.customClasses = this.customClasses.filter(cls => cls._id.toString() !== classId);
  return true;
};

// Method to toggle class visibility
userTimetableSchema.methods.toggleClassVisibility = function(classId) {
  const hiddenIndex = this.hiddenClasses.findIndex(id => id.toString() === classId);
  if (hiddenIndex === -1) {
    this.hiddenClasses.push(classId);
  } else {
    this.hiddenClasses.splice(hiddenIndex, 1);
  }
  return this.hiddenClasses.includes(classId);
};

module.exports = mongoose.model('UserTimetable', userTimetableSchema); 