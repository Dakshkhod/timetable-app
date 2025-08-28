const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔗 Attempting MongoDB Atlas connection for Railway...');
    
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-timetable';
    console.log('📍 Connecting to MongoDB Atlas...');
    
    // Railway-specific SSL workaround
    if (process.env.RAILWAY_ENVIRONMENT) {
      console.log('🚂 Railway environment detected - applying SSL fixes');
      
      // Force disable SSL certificate validation in Railway
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      
      // Remove SSL parameters and add our own
      if (mongoUri.includes('?')) {
        mongoUri = mongoUri.split('?')[0];
      }
      
      // Add Railway-compatible connection parameters
      mongoUri += '?ssl=true&authSource=admin&retryWrites=true&w=majority&tlsInsecure=true';
    }
    
    // Railway-optimized connection options
    const mongoOptions = {
      maxPoolSize: 5, // Reduced for Railway
      serverSelectionTimeoutMS: 8000, // Shorter timeout
      socketTimeoutMS: 30000,
      connectTimeoutMS: 8000,
      bufferMaxEntries: 0,
      // Railway-specific SSL settings
      ssl: true,
      sslValidate: false,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
    };
    
    console.log('⚙️  Using Railway-optimized connection settings');
    
    const conn = await mongoose.connect(mongoUri, mongoOptions);

    console.log(`✅ MongoDB Atlas Connected on Railway: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Test the connection
    await mongoose.connection.db.admin().ping();
    console.log('🏓 Railway database connection verified');
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error on Railway:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected from Railway');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected on Railway');
    });

  } catch (error) {
    console.error(`❌ MongoDB Atlas connection failed on Railway: ${error.message}`);
    
    if (error.message.includes('tls') || error.message.includes('ssl')) {
      console.log('🔒 SSL/TLS Error on Railway - Using fallback strategy');
      
      // Try alternative connection method for Railway
      try {
        console.log('🔄 Attempting Railway fallback connection...');
        
        // Force basic connection without SSL
        let fallbackUri = process.env.MONGODB_URI;
        if (fallbackUri.includes('mongodb+srv://')) {
          // Remove all SSL parameters
          fallbackUri = fallbackUri.split('?')[0];
          fallbackUri += '?ssl=false&directConnection=false&retryWrites=true&w=majority';
        }
        
        const fallbackOptions = {
          maxPoolSize: 3,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 20000,
          connectTimeoutMS: 5000,
          ssl: false,
          tls: false,
        };
        
        const conn = await mongoose.connect(fallbackUri, fallbackOptions);
        console.log('✅ Railway fallback connection successful');
        return;
        
      } catch (fallbackError) {
        console.error('❌ Railway fallback also failed:', fallbackError.message);
      }
    }
    
    // For Railway production, continue without database
    if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
      console.warn('⚠️  Railway server continuing without database connection');
      console.warn('📱 Mobile app will use offline mode features');
      return; // Don't throw, let server start
    }
    
    throw error;
  }
};

module.exports = connectDB; 