const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Assignment title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  subjectCode: {
    type: String,
    required: [true, 'Subject code is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['Assignment', 'Quiz', 'Project', 'Exam', 'Presentation', 'Lab Report'],
    default: 'Assignment'
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Completed', 'Overdue'],
    default: 'Not Started'
  },
  estimatedHours: {
    type: Number,
    min: 0.5,
    max: 100
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard', 'Very Hard'],
    default: 'Medium'
  },
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  // Google Classroom integration
  googleClassroomId: {
    type: String,
    sparse: true
  },
  googleDriveFileId: String,
  // User assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Progress tracking
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  notes: [{
    content: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // Time tracking
  timeSpent: {
    type: Number,
    default: 0, // in minutes
    min: 0
  },
  // Reminders
  reminders: [{
    time: Date,
    type: {
      type: String,
      enum: ['email', 'push', 'sms'],
      default: 'push'
    },
    sent: {
      type: Boolean,
      default: false
    }
  }],
  // AI suggestions
  aiSuggestions: {
    priority: String,
    estimatedTime: Number,
    studyPlan: [String],
    relatedTopics: [String],
    lastUpdated: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
assignmentSchema.index({ assignedTo: 1, dueDate: 1 });
assignmentSchema.index({ assignedTo: 1, status: 1 });
assignmentSchema.index({ dueDate: 1 });

// Virtual for days until due
assignmentSchema.virtual('daysUntilDue').get(function() {
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for urgency score
assignmentSchema.virtual('urgencyScore').get(function() {
  const daysUntilDue = this.daysUntilDue;
  const priorityScore = {
    'Low': 1,
    'Medium': 2,
    'High': 3,
    'Urgent': 4
  };
  
  let score = priorityScore[this.priority] || 2;
  
  if (daysUntilDue <= 1) score += 5;
  else if (daysUntilDue <= 3) score += 3;
  else if (daysUntilDue <= 7) score += 1;
  
  if (this.difficulty === 'Hard') score += 2;
  else if (this.difficulty === 'Very Hard') score += 3;
  
  return Math.min(score, 10); // Max score of 10
});

// Method to check if assignment is overdue
assignmentSchema.methods.isOverdue = function() {
  return new Date() > this.dueDate && this.status !== 'Completed';
};

// Method to update status based on due date
assignmentSchema.methods.updateStatus = function() {
  if (this.status === 'Completed') return;
  
  if (this.isOverdue()) {
    this.status = 'Overdue';
  } else if (this.progress > 0 && this.progress < 100) {
    this.status = 'In Progress';
  } else if (this.progress === 0) {
    this.status = 'Not Started';
  }
};

// Pre-save middleware to update status
assignmentSchema.pre('save', function(next) {
  this.updateStatus();
  next();
});

// Ensure virtual fields are serialized
assignmentSchema.set('toJSON', { virtuals: true });
assignmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Assignment', assignmentSchema); 