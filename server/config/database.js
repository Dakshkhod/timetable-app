const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Force disable ALL SSL certificate validation
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-timetable';
    
    // For Railway deployment - use connection string without SSL requirements
    if (mongoUri.includes('mongodb+srv://')) {
      // Remove SSL parameters and use basic connection
      mongoUri = mongoUri.split('?')[0]; // Remove all query parameters
      mongoUri += '?ssl=false&tls=false';
    }
    
    const mongoOptions = {
      ssl: false,
      tls: false,
      sslValidate: false,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      serverSelectionTimeoutMS: 5000, // Fail fast if can't connect
    };
    
    console.log('🔄 Attempting MongoDB connection without SSL...');
    
    const conn = await mongoose.connect(mongoUri, mongoOptions);

    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('⚠️  App will start without database connection.');
    console.log('📋 To fix this:');
    console.log('   1. Install MongoDB locally, or');
    console.log('   2. Use MongoDB Atlas (cloud) in your .env file');
    console.log('   3. Update MONGODB_URI in .env with your connection string');
    
    // Don't exit in production - let the app run without database
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB; 