const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
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
  rollNumber: {
    type: String,
    required: [true, 'Roll number is required'],
    unique: true
  },
  googleAuth: {
    accessToken: String,
    refreshToken: String,
    tokenExpiry: Date,
    isConnected: { type: Boolean, default: false },
    lastSync: Date,
    classroomId: String,
    profile: {
      id: String,
      name: String,
      email: String,
      photoUrl: String
    }
  },
  // Preferences for Google Classroom integration
  googlePreferences: {
    selectedCourseIds: {
      type: [String],
      default: []
    },
    collapsed: { type: Boolean, default: true }
  },
  // Planner tasks
  plannerTasks: [{
    _id: String,
    title: { type: String, required: true },
    description: String,
    dueDate: { type: Date, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    category: { type: String, enum: ['study', 'assignment', 'exam', 'personal'], default: 'study' },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    estimatedTime: { type: Number, default: 60 }, // in minutes
    isRecurring: { type: Boolean, default: false },
    recurringPattern: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    theme: { type: String, default: 'light', enum: ['light', 'dark', 'auto'] },
    timezone: { type: String, default: 'Asia/Kolkata' }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get user profile (without password)
userSchema.methods.getProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  // Keep googleAuth.isConnected for frontend status display
  if (userObject.googleAuth) {
    userObject.googleAuth = {
      isConnected: userObject.googleAuth.isConnected,
      lastSync: userObject.googleAuth.lastSync
    };
  }
  return userObject;
};

module.exports = mongoose.model('User', userSchema); 