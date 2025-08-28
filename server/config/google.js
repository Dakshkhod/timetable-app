const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;

// Google OAuth 2.0 configuration
const GOOGLE_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  // Must point to the server route that handles the OAuth callback
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google/callback',
  scopes: [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me',
    'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ]
};

// Create OAuth2 client
const createOAuth2Client = () => {
  return new OAuth2(
    GOOGLE_CONFIG.clientId,
    GOOGLE_CONFIG.clientSecret,
    GOOGLE_CONFIG.redirectUri
  );
};

// Generate authorization URL
const generateAuthUrl = (state = '') => {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_CONFIG.scopes,
    prompt: 'consent',
    state: state
  });
};

// Exchange authorization code for tokens (allow override redirectUri)
const getTokensFromCode = async (code, redirectUriOverride) => {
  try {
    const oauth2Client = redirectUriOverride
      ? new OAuth2(GOOGLE_CONFIG.clientId, GOOGLE_CONFIG.clientSecret, redirectUriOverride)
      : createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Error getting tokens:', error);
    throw new Error('Failed to exchange authorization code for tokens');
  }
};

// Create authenticated Google Classroom client
const createClassroomClient = (accessToken) => {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.classroom({ version: 'v1', auth: oauth2Client });
};

// Create authenticated Google Drive client
const createDriveClient = (accessToken) => {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
};

// Refresh access token
const refreshAccessToken = async (refreshToken) => {
  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials;
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw new Error('Failed to refresh access token');
  }
};

module.exports = {
  GOOGLE_CONFIG,
  createOAuth2Client,
  generateAuthUrl,
  getTokensFromCode,
  createClassroomClient,
  createDriveClient,
  refreshAccessToken
};
