const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validation');
const { getTokensFromCode } = require('../config/google');
const { google } = require('googleapis');
const { 
  registerSchema, 
  loginSchema, 
  profileUpdateSchema,
  changePasswordSchema,
  passwordResetRequestSchema,
  passwordResetSchema
} = require('../schemas/auth');

const router = express.Router();

// JWT token utilities
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  
  return { accessToken, refreshToken };
};

const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    // Accept both web and mobile payloads
    const {
      name,
      firstName,
      lastName,
      email,
      password,
      branch,
      year,
      rollNumber
    } = req.body || {};

    const fullName = (name && String(name).trim()) || [firstName, lastName].filter(Boolean).join(' ').trim();

    // Normalize branch to match enum values in the schema
    const normalizeBranch = (b) => {
      if (!b) return b;
      const map = {
        'CSE': 'Computer Science',
        'CS': 'Computer Science',
        'MECH': 'Mechanical',
        'MECHANICAL': 'Mechanical',
        'EEE': 'Electrical',
        'ELECTRICAL': 'Electrical',
        'CIVIL': 'Civil',
        'CHEM': 'Chemical',
        'CHEMICAL': 'Chemical',
        'ECE': 'Electronics',
        'ELECTRONICS': 'Electronics',
        'MME': 'Material and Metallurgical Engineering',
        'METALLURGICAL': 'Material and Metallurgical Engineering'
      };
      const up = String(b).trim().toUpperCase();
      return map[up] || b;
    };

    const parsedYear = typeof year === 'string' ? parseInt(year, 10) : year;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { rollNumber }] 
    });
    
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: existingUser.email === email ? 'Email already registered' : 'Roll number already exists'
      });
    }

    // Create new user
    const user = new User({
      name: fullName,
      email,
      password,
      branch: normalizeBranch(branch),
      year: parsedYear,
      rollNumber
    });

    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.getProfile(),
        accessToken,
        refreshToken
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account disabled',
        message: 'Your account has been disabled. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getProfile(),
        accessToken,
        refreshToken
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refresh token', message: 'refreshToken is required' });
    }
    const decoded = verifyRefreshToken(refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
    res.json({
      success: true,
      message: 'Token refreshed',
      data: { accessToken, refreshToken: newRefreshToken },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token', message: error.message });
  }
});

// @route   POST /api/auth/logout
// @desc    Invalidate session (stateless JWT, no-op)
// @access  Public
router.post('/logout', async (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

// @route   POST /api/auth/google-mobile
// @desc    Google OAuth for mobile: exchange code, create/find user, return JWTs
// @access  Public
router.post('/google-mobile', async (req, res) => {
  try {
    const { authorizationCode, redirectUri } = req.body || {};
    if (!authorizationCode || !redirectUri) {
      return res.status(400).json({ error: 'Invalid request', message: 'authorizationCode and redirectUri are required' });
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(authorizationCode, redirectUri);
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: tokens.access_token });
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile || !profile.email) {
      return res.status(400).json({ error: 'Google profile error', message: 'Email not available from Google' });
    }

    // Find or create user
    let user = await User.findOne({ email: profile.email });
    if (!user) {
      const generatedRoll = `G${Date.now().toString().slice(-8)}`;
      user = new User({
        name: profile.name || profile.email.split('@')[0],
        email: profile.email,
        password: crypto.randomBytes(16).toString('hex'),
        branch: 'Computer Science',
        year: 1,
        rollNumber: generatedRoll,
        googleAuth: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expiry_date,
          isConnected: true,
          lastSync: new Date()
        }
      });
      await user.save();
    } else {
      await User.findByIdAndUpdate(user._id, {
        'googleAuth.accessToken': tokens.access_token,
        'googleAuth.refreshToken': tokens.refresh_token,
        'googleAuth.tokenExpiry': tokens.expiry_date,
        'googleAuth.isConnected': true,
        'googleAuth.lastSync': new Date()
      });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    res.json({
      success: true,
      message: 'Google login successful',
      data: {
        user: user.getProfile(),
        accessToken,
        refreshToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Google mobile login error:', error);
    res.status(500).json({ error: 'Google login failed', message: error.message });
  }
});

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    res.json({
      user: user.getProfile()
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, branch, year, preferences } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (branch) updateData.branch = branch;
    if (year) updateData.year = year;
    if (preferences) updateData.preferences = preferences;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    res.json({
      message: 'Profile updated successfully',
      user: user.getProfile()
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message
    });
  }
});

// @route   PUT /api/auth/password
// @desc    Change password
// @access  Private
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'Current password and new password are required'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        error: 'Invalid password',
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      error: 'Failed to change password',
      message: error.message
    });
  }
});

// @route   POST /api/auth/google
// @desc    Google OAuth integration
// @access  Private
router.post('/google', auth, async (req, res) => {
  try {
    const { access_token, refresh_token, expiry_date } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        googleTokens: {
          access_token,
          refresh_token,
          expiry_date
        }
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    res.json({
      message: 'Google account linked successfully',
      user: user.getProfile()
    });

  } catch (error) {
    console.error('Google integration error:', error);
    res.status(500).json({
      error: 'Failed to link Google account',
      message: error.message
    });
  }
});

// Mobile Google OAuth endpoint
router.post('/google/mobile', async (req, res) => {
  try {
    const { authorizationCode, redirectUri } = req.body;
    
    if (!authorizationCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Authorization code is required' 
      });
    }

    console.log('📱 Mobile Google OAuth - Processing authorization code...');

    // Exchange authorization code for tokens
    const tokenData = await getTokensFromCode(authorizationCode, redirectUri);
    
    if (!tokenData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Failed to exchange authorization code for tokens' 
      });
    }

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    oauth2Client.setCredentials(tokenData);
    
    const userInfoResponse = await oauth2.userinfo.get();
    const googleUser = userInfoResponse.data;

    if (!googleUser.email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Failed to get user email from Google' 
      });
    }

    console.log('📱 Mobile Google OAuth - User info received:', googleUser.email);

    // Check if user exists
    let user = await User.findOne({ email: googleUser.email });

    if (!user) {
      // Create new user from Google data
      console.log('📱 Creating new user from Google data...');
      user = await User.create({
        email: googleUser.email,
        firstName: googleUser.given_name || 'User',
        lastName: googleUser.family_name || '',
        name: googleUser.name || `${googleUser.given_name} ${googleUser.family_name}`,
        profilePicture: googleUser.picture,
        isActive: true,
        authProvider: 'google',
        googleId: googleUser.id,
        // Set default academic info
        branch: 'Computer Science',
        year: 1,
        rollNumber: `GOOGLE_${Date.now()}`,
      });
    } else {
      // Update existing user with Google data
      user.googleId = googleUser.id;
      user.profilePicture = googleUser.picture;
      user.authProvider = 'google';
      await user.save();
    }

    // Store Google tokens for API access
    user.googleTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiryDate: new Date(Date.now() + (tokenData.expires_in * 1000)),
    };
    await user.save();

    // Generate JWT token
    const jwtToken = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        authProvider: 'google'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set session
    req.session.userId = user._id;
    req.session.save();

    console.log('✅ Mobile Google OAuth successful for:', user.email);

    res.json({
      success: true,
      message: 'Google authentication successful',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        profilePicture: user.profilePicture,
        branch: user.branch,
        year: user.year,
        rollNumber: user.rollNumber,
        authProvider: user.authProvider,
      },
      token: jwtToken,
    });

  } catch (error) {
    console.error('❌ Mobile Google OAuth error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Google authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router; 