const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Simple connection string without SSL for development
    const mongoUri = process.env.MONGODB_URI ? 
      process.env.MONGODB_URI.replace('mongodb+srv://', 'mongodb://').replace('/?retryWrites=true&w=majority', '') :
      'mongodb://localhost:27017/smart-timetable';
      
    console.log('🔄 Attempting simplified MongoDB connection...');
    
    const conn = await mongoose.connect(mongoUri, {
      ssl: false,
      tls: false,
      directConnection: true
    });

    console.log(`📦 MongoDB Connected (Simple): ${conn.connection.host}`);
    return conn;
    
  } catch (error) {
    console.error('❌ Simplified database connection failed:', error.message);
    console.log('⚠️  App will continue without database.');
    return null;
  }
};

module.exports = connectDB;
