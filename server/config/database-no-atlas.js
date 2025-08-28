const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔄 Starting app WITHOUT database connection...');
    console.log('⚠️  MongoDB Atlas SSL issues in Railway environment');
    console.log('✅ App will run with in-memory data (for now)');
    
    // Don't connect to any database - just start the app
    // This allows the API to work while we fix the database later
    
    return null;
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return null;
  }
};

module.exports = connectDB;
