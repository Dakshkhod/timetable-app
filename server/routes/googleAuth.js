const express = require('express');
const { generateAuthUrl, getTokensFromCode, refreshAccessToken } = require('../config/google');
const GoogleClassroomService = require('../services/googleClassroom');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/google/auth
// @desc    Generate Google OAuth URL
// @access  Private
router.get('/auth', auth, (req, res) => {
  try {
    const state = req.user.userId; // Use user ID as state for security
    const authUrl = generateAuthUrl(state);
    
    res.json({
      authUrl,
      message: 'Google OAuth URL generated successfully'
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      error: 'Failed to generate Google OAuth URL',
      message: error.message
    });
  }
});

// @route   GET /api/google/callback
// @desc    Handle Google OAuth callback
// @access  Public (called by Google)
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect(`/auth/google/error?error=${encodeURIComponent(error)}`);
    }
    
    if (!code || !state) {
      return res.redirect('/auth/google/error?error=Missing authorization code or state');
    }
    
    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);
    
    // Update user with Google tokens
    await User.findByIdAndUpdate(state, {
      'googleAuth.accessToken': tokens.access_token,
      'googleAuth.refreshToken': tokens.refresh_token,
      'googleAuth.tokenExpiry': tokens.expiry_date,
      'googleAuth.isConnected': true,
      'googleAuth.lastSync': new Date()
    });
    
    // Redirect back to the frontend after successful link
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/assignments?google=success`);
    
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/assignments?google=error&message=${encodeURIComponent(error.message)}`);
  }
});

// @route   POST /api/google/sync
// @desc    Sync assignments from Google Classroom
// @access  Private
router.post('/sync', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user.googleAuth?.isConnected) {
      return res.status(400).json({
        error: 'Google Classroom not connected',
        message: 'Please connect your Google Classroom account first'
      });
    }
    
    // Check if token needs refresh
    let accessToken = user.googleAuth.accessToken;
    if (user.googleAuth.tokenExpiry && new Date() > user.googleAuth.tokenExpiry) {
      const newTokens = await refreshAccessToken(user.googleAuth.refreshToken);
      accessToken = newTokens.access_token;
      
      // Update user with new tokens
      await User.findByIdAndUpdate(userId, {
        'googleAuth.accessToken': newTokens.access_token,
        'googleAuth.tokenExpiry': newTokens.expiry_date,
        'googleAuth.lastSync': new Date()
      });
    }
    
    // Initialize Google Classroom service
    const classroomService = new GoogleClassroomService(accessToken);
    
    // Fetch all assignments
    const assignments = await classroomService.getAllAssignments();
    
    // Update last sync time
    await User.findByIdAndUpdate(userId, {
      'googleAuth.lastSync': new Date()
    });
    
    res.json({
      message: 'Google Classroom sync completed successfully',
      assignments: assignments,
      totalAssignments: assignments.length,
      lastSync: new Date()
    });
    
  } catch (error) {
    console.error('Google Classroom sync error:', error);
    res.status(500).json({
      error: 'Failed to sync Google Classroom',
      message: error.message
    });
  }
});

// @route   GET /api/google/courses
// @desc    Get user's Google Classroom courses
// @access  Private
router.get('/courses', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user.googleAuth?.isConnected) {
      return res.status(400).json({
        error: 'Google Classroom not connected',
        message: 'Please connect your Google Classroom account first'
      });
    }
    
    // Check if token needs refresh
    let accessToken = user.googleAuth.accessToken;
    if (user.googleAuth.tokenExpiry && new Date() > user.googleAuth.tokenExpiry) {
      const newTokens = await refreshAccessToken(user.googleAuth.refreshToken);
      accessToken = newTokens.access_token;
      
      // Update user with new tokens
      await User.findByIdAndUpdate(userId, {
        'googleAuth.accessToken': newTokens.access_token,
        'googleAuth.tokenExpiry': newTokens.expiry_date
      });
    }
    
    const classroomService = new GoogleClassroomService(accessToken);
    const courses = await classroomService.getCourses();
    
    res.json({
      courses,
      totalCourses: courses.length,
      message: 'Courses fetched successfully'
    });
    
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      error: 'Failed to fetch Google Classroom courses',
      message: error.message
    });
  }
});

// @route   GET /api/google/assignments
// @desc    Get assignments from Google Classroom with real-time data
// @access  Private
router.get('/assignments', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { courseId, filter } = req.query;
    const user = await User.findById(userId);
    
    if (!user.googleAuth?.isConnected) {
      return res.status(400).json({
        error: 'Google Classroom not connected',
        message: 'Please connect your Google Classroom account first'
      });
    }
    
    // Check if token needs refresh
    let accessToken = user.googleAuth.accessToken;
    if (user.googleAuth.tokenExpiry && new Date() > user.googleAuth.tokenExpiry) {
      const newTokens = await refreshAccessToken(user.googleAuth.refreshToken);
      accessToken = newTokens.access_token;
      
      // Update user with new tokens
      await User.findByIdAndUpdate(userId, {
        'googleAuth.accessToken': newTokens.access_token,
        'googleAuth.tokenExpiry': newTokens.expiry_date
      });
    }
    
    const classroomService = new GoogleClassroomService(accessToken);
    
    let assignments;
    if (courseId) {
      assignments = await classroomService.getCourseAssignments(courseId);
    } else if (filter === 'upcoming') {
      assignments = await classroomService.getUpcomingAssignments();
    } else if (filter === 'overdue') {
      assignments = await classroomService.getOverdueAssignments();
    } else {
      assignments = await classroomService.getAllAssignments();
    }
    
    // Update last sync time for real-time tracking
    await User.findByIdAndUpdate(userId, {
      'googleAuth.lastSync': new Date()
    });

    res.json({
      assignments,
      totalAssignments: assignments.length,
      filter: filter || 'all',
      courseId: courseId || null,
      lastSync: new Date(),
      message: 'Assignments fetched successfully'
    });
    
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      error: 'Failed to fetch Google Classroom assignments',
      message: error.message
    });
  }
});

// @route   GET /api/google/announcements
// @desc    Get recent announcements (optionally by courseId)
// @access  Private
router.get('/announcements', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { courseId, limit } = req.query;
    const user = await User.findById(userId);

    if (!user.googleAuth?.isConnected) {
      return res.status(400).json({
        error: 'Google Classroom not connected',
        message: 'Please connect your Google Classroom account first'
      });
    }

    // Check token
    let accessToken = user.googleAuth.accessToken;
    if (user.googleAuth.tokenExpiry && new Date() > user.googleAuth.tokenExpiry) {
      const newTokens = await refreshAccessToken(user.googleAuth.refreshToken);
      accessToken = newTokens.access_token;
      await User.findByIdAndUpdate(userId, {
        'googleAuth.accessToken': newTokens.access_token,
        'googleAuth.tokenExpiry': newTokens.expiry_date
      });
    }

    const classroomService = new GoogleClassroomService(accessToken);

    let announcements;
    if (courseId) {
      announcements = await classroomService.getCourseAnnouncements(courseId, parseInt(limit || '10', 10));
    } else {
      announcements = await classroomService.getAllAnnouncements(parseInt(limit || '5', 10));
    }

    res.json({
      announcements,
      total: announcements.length,
      message: 'Announcements fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      error: 'Failed to fetch announcements',
      message: error.message
    });
  }
});

// @route   POST /api/google/disconnect
// @desc    Disconnect Google Classroom account
// @access  Private
router.post('/disconnect', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await User.findByIdAndUpdate(userId, {
      'googleAuth.accessToken': null,
      'googleAuth.refreshToken': null,
      'googleAuth.tokenExpiry': null,
      'googleAuth.isConnected': false,
      'googleAuth.lastSync': null
    });
    
    res.json({
      message: 'Google Classroom account disconnected successfully'
    });
    
  } catch (error) {
    console.error('Error disconnecting Google account:', error);
    res.status(500).json({
      error: 'Failed to disconnect Google Classroom account',
      message: error.message
    });
  }
});

// @route   GET /api/google/status
// @desc    Get Google Classroom connection status with real-time sync
// @access  Private
router.get('/status', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    const status = {
      isConnected: user.googleAuth?.isConnected || false,
      lastSync: user.googleAuth?.lastSync || null,
      hasValidToken: false,
      selectedCourseIds: user.googlePreferences?.selectedCourseIds || [],
      collapsed: user.googlePreferences?.collapsed ?? true
    };
    
    if (user.googleAuth?.isConnected && user.googleAuth?.accessToken) {
      // Check if token is still valid
      if (!user.googleAuth.tokenExpiry || new Date() < user.googleAuth.tokenExpiry) {
        status.hasValidToken = true;
      }
    }
    
    res.json({
      status,
      message: 'Google Classroom status retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error getting Google status:', error);
    res.status(500).json({
      error: 'Failed to get Google Classroom status',
      message: error.message
    });
  }
});

// @route   GET /api/google/preferences
// @desc    Get stored Google Classroom UI preferences
// @access  Private
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json({
      selectedCourseIds: user.googlePreferences?.selectedCourseIds || [],
      collapsed: user.googlePreferences?.collapsed ?? true
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load preferences', message: error.message });
  }
});

// @route   POST /api/google/preferences
// @desc    Save selected course ids and UI collapsed state
// @access  Private
router.post('/preferences', auth, async (req, res) => {
  try {
    const { selectedCourseIds, collapsed } = req.body || {};
    const update = {};
    if (Array.isArray(selectedCourseIds)) update['googlePreferences.selectedCourseIds'] = selectedCourseIds;
    if (typeof collapsed === 'boolean') update['googlePreferences.collapsed'] = collapsed;
    const user = await User.findByIdAndUpdate(req.user.userId, update, { new: true });
    res.json({
      message: 'Preferences saved',
      selectedCourseIds: user.googlePreferences?.selectedCourseIds || [],
      collapsed: user.googlePreferences?.collapsed ?? true
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save preferences', message: error.message });
  }
});

module.exports = router;
