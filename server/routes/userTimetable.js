const express = require('express');
const PersonalTimetable = require('../models/PersonalTimetable');
const auth = require('../middleware/auth');

const router = express.Router();

// Test route to check if userTimetable routes are accessible
router.get('/test', (req, res) => {
  res.json({ message: 'UserTimetable routes are working!' });
});

// @route   GET /api/user-timetable/my
// @desc    Get user's personalized timetable
// @access  Private
router.get('/my', auth, async (req, res) => {
  try {
    console.log('🔍 User timetable request received');
    console.log('User ID:', req.user.userId);
    
    const userId = req.user.userId;
    
    // Find user's personal timetable
    let personalTimetable = await PersonalTimetable.findOne({ userId });
    console.log('Existing personal timetable:', personalTimetable ? 'Found' : 'Not found');
    
    if (!personalTimetable) {
      console.log('Creating new personal timetable...');
      // Create personal timetable if it doesn't exist
      personalTimetable = new PersonalTimetable({
        userId,
        branch: req.userProfile.branch,
        year: req.userProfile.year,
        semester: 1,
        academicYear: '2024-25',
        isActive: true,
        classes: []
      });
      await personalTimetable.save();
      console.log('✅ New personal timetable created');
    }
    
    console.log('Personal timetable classes:', personalTimetable.classes.length);
    
    res.json({
      timetable: personalTimetable,
      classes: personalTimetable.classes,
      preferences: personalTimetable.preferences,
      message: 'Personal timetable retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ User timetable fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch user timetable',
      message: error.message
    });
  }
});

// @route   POST /api/user-timetable/class
// @desc    Add a class to user's timetable
// @access  Private
router.post('/class', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subject, subjectCode, teacher, room, type, timeSlot, day, weekType, color } = req.body;
    
    console.log('📝 Creating new class:', { subject, day, timeSlot, userId });
    
    // Validate required fields
    if (!subject || !timeSlot || !day) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Subject, time slot, and day are required'
      });
    }
    
    // Validate time slot format
    if (!timeSlot.startTime || !timeSlot.endTime) {
      return res.status(400).json({
        error: 'Invalid time slot',
        message: 'Start time and end time are required'
      });
    }
    
    // Find or create personal timetable
    let personalTimetable = await PersonalTimetable.findOne({ userId });
    if (!personalTimetable) {
      personalTimetable = new PersonalTimetable({
        userId,
        branch: req.userProfile.branch,
        year: req.userProfile.year,
        semester: 1,
        academicYear: '2024-25',
        isActive: true,
        classes: []
      });
    }
    
    // Check if time slot is available using the model's method
    // This will properly handle base class editing by excluding the class being edited
    if (!personalTimetable.isTimeSlotAvailable(day, timeSlot.startTime, timeSlot.endTime)) {
      return res.status(409).json({
        error: 'Time slot conflict',
        message: 'The selected time slot conflicts with an existing class'
      });
    }
    
    // Add class
    const newClass = personalTimetable.addClass({
      subject,
      subjectCode,
      teacher,
      room,
      type: type || 'Lecture',
      timeSlot,
      day,
      weekType: weekType || 'All',
      color: color || personalTimetable.preferences.defaultColor
    });
    
    await personalTimetable.save();
    
    res.status(201).json({
      message: 'Class added successfully',
      class: newClass
    });
    
  } catch (error) {
    console.error('Class creation error:', error);
    res.status(500).json({
      error: 'Failed to add class',
      message: error.message
    });
  }
});

// @route   PUT /api/user-timetable/class/:classId
// @desc    Update a class
// @access  Private
router.put('/class/:classId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { classId } = req.params;
    const updates = req.body;
    
    const personalTimetable = await PersonalTimetable.findOne({ userId });
    if (!personalTimetable) {
      return res.status(404).json({
        error: 'Personal timetable not found',
        message: 'Personal timetable does not exist'
      });
    }
    
    // If time slot is being updated, check for conflicts
    if (updates.timeSlot && updates.day) {
      if (!personalTimetable.isTimeSlotAvailable(updates.day, updates.timeSlot.startTime, updates.timeSlot.endTime, classId)) {
        return res.status(409).json({
          error: 'Time slot conflict',
          message: 'The selected time slot conflicts with an existing class'
        });
      }
    }
    
    const updatedClass = personalTimetable.updateClass(classId, updates);
    if (!updatedClass) {
      return res.status(404).json({
        error: 'Class not found',
        message: 'Class does not exist'
      });
    }
    
    await personalTimetable.save();
    
    res.json({
      message: 'Class updated successfully',
      class: updatedClass
    });
    
  } catch (error) {
    console.error('Class update error:', error);
    res.status(500).json({
      error: 'Failed to update class',
      message: error.message
    });
  }
});

// @route   DELETE /api/user-timetable/class/:classId
// @desc    Remove a class
// @access  Private
router.delete('/class/:classId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { classId } = req.params;
    
    const personalTimetable = await PersonalTimetable.findOne({ userId });
    if (!personalTimetable) {
      return res.status(404).json({
        error: 'Personal timetable not found',
        message: 'Personal timetable does not exist'
      });
    }
    
    const removed = personalTimetable.removeClass(classId);
    if (!removed) {
      return res.status(404).json({
        error: 'Class not found',
        message: 'Class does not exist'
      });
    }
    
    await personalTimetable.save();
    
    res.json({
      message: 'Class removed successfully'
    });
    
  } catch (error) {
    console.error('Class removal error:', error);
    res.status(500).json({
      error: 'Failed to remove class',
      message: error.message
    });
  }
});

// @route   PUT /api/user-timetable/preferences
// @desc    Update user timetable preferences
// @access  Private
router.put('/preferences', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { defaultColor, showWeekends, timeFormat, defaultSlotDuration } = req.body;
    
    const personalTimetable = await PersonalTimetable.findOne({ userId });
    if (!personalTimetable) {
      return res.status(404).json({
        error: 'Personal timetable not found',
        message: 'Personal timetable does not exist'
      });
    }
    
    // Update preferences
    if (defaultColor) personalTimetable.preferences.defaultColor = defaultColor;
    if (showWeekends !== undefined) personalTimetable.preferences.showWeekends = showWeekends;
    if (timeFormat) personalTimetable.preferences.timeFormat = timeFormat;
    if (defaultSlotDuration) personalTimetable.preferences.defaultSlotDuration = defaultSlotDuration;
    
    await personalTimetable.save();
    
    res.json({
      message: 'Preferences updated successfully',
      preferences: personalTimetable.preferences
    });
    
  } catch (error) {
    console.error('Preferences update error:', error);
    res.status(500).json({
      error: 'Failed to update preferences',
      message: error.message
    });
  }
});

// @route   GET /api/user-timetable/daily/:day
// @desc    Get user's daily schedule
// @access  Private
router.get('/daily/:day', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { day } = req.params;
    
    const personalTimetable = await PersonalTimetable.findOne({ userId });
    if (!personalTimetable) {
      return res.status(404).json({
        error: 'Personal timetable not found',
        message: 'Personal timetable does not exist'
      });
    }
    
    // Get classes for specific day
    const dayClasses = personalTimetable.getClassesForDay(day);
    
    res.json({
      day,
      classes: dayClasses,
      totalClasses: dayClasses.length,
      message: `Daily schedule for ${day} retrieved successfully`
    });
    
  } catch (error) {
    console.error('Daily personal timetable error:', error);
    res.status(500).json({
      error: 'Failed to fetch daily personal timetable',
      message: error.message
    });
  }
});

// @route   GET /api/user-timetable/available-slots/:day
// @desc    Get available time slots for a specific day
// @access  Private
router.get('/available-slots/:day', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { day } = req.params;
    const { startHour = 8, endHour = 18 } = req.query;
    
    const personalTimetable = await PersonalTimetable.findOne({ userId });
    if (!personalTimetable) {
      return res.status(404).json({
        error: 'Personal timetable not found',
        message: 'Personal timetable does not exist'
      });
    }
    
    // Get available time slots
    const availableSlots = personalTimetable.getAvailableTimeSlots(day, parseInt(startHour), parseInt(endHour));
    
    res.json({
      day,
      availableSlots,
      totalAvailable: availableSlots.length,
      message: `Available time slots for ${day} retrieved successfully`
    });
    
  } catch (error) {
    console.error('Available slots error:', error);
    res.status(500).json({
      error: 'Failed to fetch available time slots',
      message: error.message
    });
  }
});

// @route   POST /api/user-timetable/check-availability
// @desc    Check if a specific time slot is available
// @access  Private
router.post('/check-availability', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { day, startTime, endTime, excludeClassId } = req.body;
    
    if (!day || !startTime || !endTime) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Day, start time, and end time are required'
      });
    }
    
    const personalTimetable = await PersonalTimetable.findOne({ userId });
    if (!personalTimetable) {
      return res.status(404).json({
        error: 'Personal timetable not found',
        message: 'Personal timetable does not exist'
      });
    }
    
    // Check availability
    const isAvailable = personalTimetable.isTimeSlotAvailable(day, startTime, endTime, excludeClassId);
    
    res.json({
      day,
      startTime,
      endTime,
      isAvailable,
      message: isAvailable ? 'Time slot is available' : 'Time slot conflicts with existing classes'
    });
    
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({
      error: 'Failed to check availability',
      message: error.message
    });
  }
});

module.exports = router; 