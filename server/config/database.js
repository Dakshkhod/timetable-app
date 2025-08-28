const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-timetable';
    console.log('📍 URI:', mongoUri.replace(/mongodb\+srv:\/\/.*@/, 'mongodb+srv://***:***@'));
    
    // Modern connection options (no deprecated settings)
    const mongoOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      connectTimeoutMS: 15000,
    };
    
    const conn = await mongoose.connect(mongoUri, mongoOptions);

    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`.green);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Test connection
    await mongoose.connection.db.admin().ping();
    console.log('🏓 Database ping successful');
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

  } catch (error) {
    console.error(`❌ Database connection failed: ${error.message}`.red);
    
    if (error.message.includes('tls') || error.message.includes('ssl')) {
      console.log('🔒 SSL/TLS Error - This is common with MongoDB Atlas on Railway');
      console.log('💡 Suggestions:');
      console.log('   1. Ensure your MongoDB Atlas cluster allows connections from anywhere (0.0.0.0/0)');
      console.log('   2. Check if your connection string includes proper authentication');
      console.log('   3. Verify your MongoDB Atlas cluster is running');
    }
    
    // In production, continue without database but log the issue
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  Server will continue without database. Some features may not work.');
      return;
    }
    
    throw error;
  }
};

module.exports = connectDB; 