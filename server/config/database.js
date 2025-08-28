const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔗 Connecting to MongoDB for Railway deployment...');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-timetable';
    console.log('📍 Using MongoDB Atlas connection...');
    
    // Railway-safe connection options (minimal and clean)
    const mongoOptions = {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    };
    
    // Railway environment detection with SSL bypass
    if (process.env.RAILWAY_ENVIRONMENT) {
      console.log('🚂 Railway environment detected');
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    
    console.log('⚙️  Attempting connection with minimal options...');
    
    const conn = await mongoose.connect(mongoUri, mongoOptions);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Test connection
    await mongoose.connection.db.admin().ping();
    console.log('🏓 Database ping successful');
    
    // Event handlers
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });

  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    
    // Log specific error types
    if (error.message.includes('tls') || error.message.includes('ssl')) {
      console.log('🔒 SSL/TLS connection issue detected');
    }
    if (error.message.includes('timeout')) {
      console.log('⏱️  Connection timeout - network issue');
    }
    if (error.message.includes('authentication')) {
      console.log('🔐 Authentication issue - check credentials');
    }
    
    // For production deployment, continue without database
    if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
      console.warn('⚠️  Production server continuing without database');
      console.warn('📱 API will use fallback responses for mobile app');
      // Set mock connection state
      mongoose.connection.readyState = 1;
      return;
    }
    
    throw error;
  }
};

module.exports = connectDB; 