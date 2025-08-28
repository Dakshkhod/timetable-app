const mongoose = require('mongoose');
const Timetable = require('../models/Timetable');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-timetable', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function clearTimetables() {
  try {
    console.log('🗑️  Clearing all fixed timetables...');
    
    // Remove all timetables
    const result = await Timetable.deleteMany({});
    
    console.log(`✅ Cleared ${result.deletedCount} timetables`);
    console.log('🎯 Users will now start with blank timetables');
    console.log('💡 Each user can now create their own personalized schedule');
    
  } catch (error) {
    console.error('❌ Error clearing timetables:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

clearTimetables();
