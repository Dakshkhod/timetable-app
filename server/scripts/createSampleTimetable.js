const mongoose = require('mongoose');
const User = require('../models/User');
const PersonalTimetable = require('../models/PersonalTimetable');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-timetable', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function createSampleTimetable() {
  try {
    console.log('🎯 Creating/updating sample timetable for admin user...');
    
    // Find the admin user
    const adminUser = await User.findOne({ email: 'admin@college.edu' });
    if (!adminUser) {
      console.log('❌ Admin user not found. Please run seedTimetables.js first.');
      return;
    }
    
    // Check if personal timetable already exists
    let personalTimetable = await PersonalTimetable.findOne({ userId: adminUser._id });
    
    if (personalTimetable) {
      console.log('📝 Updating existing personal timetable...');
      // Clear existing classes
      personalTimetable.classes = [];
    } else {
      console.log('🆕 Creating new personal timetable...');
      // Create new personal timetable
      personalTimetable = new PersonalTimetable({
        userId: adminUser._id,
        branch: adminUser.branch,
        year: adminUser.year,
        semester: 3,
        academicYear: '2024-25',
        isActive: true,
        classes: []
      });
    }
    
    // Add sample classes with flexible time slots
    const sampleClasses = [
      // Regular 50-minute class (9:00-9:50) - with all fields
      {
        subject: 'Introduction to Engineering',
        subjectCode: 'ENG101',
        teacher: 'Dr. Smith',
        room: 'Main Hall A',
        type: 'Lecture',
        timeSlot: { startTime: '09:00', endTime: '09:50' },
        day: 'Monday',
        weekType: 'All',
        color: '#3B82F6'
      },
      // Regular 50-minute class (10:00-10:50) - with some optional fields
      {
        subject: 'Mathematics for Engineers',
        subjectCode: 'MATH201',
        teacher: 'Prof. Johnson',
        room: 'Room 201',
        type: 'Lecture',
        timeSlot: { startTime: '10:00', endTime: '10:50' },
        day: 'Monday',
        weekType: 'All',
        color: '#10B981'
      },
      // Extended 2-hour lab (14:00-16:00) - minimal fields
      {
        subject: 'Physics Lab',
        type: 'Lab',
        timeSlot: { startTime: '14:00', endTime: '16:00' },
        day: 'Monday',
        weekType: 'All',
        color: '#F59E0B'
      },
      // Extended 2-hour lab (9:00-11:00) - with some optional fields
      {
        subject: 'Computer Programming Lab',
        subjectCode: 'CS101L',
        teacher: 'Prof. Brown',
        type: 'Lab',
        timeSlot: { startTime: '09:00', endTime: '11:00' },
        day: 'Tuesday',
        weekType: 'All',
        color: '#8B5CF6'
      },
      // Regular 50-minute class (13:00-13:50) - minimal fields
      {
        subject: 'English Communication',
        type: 'Lecture',
        timeSlot: { startTime: '13:00', endTime: '13:50' },
        day: 'Tuesday',
        weekType: 'All',
        color: '#EF4444'
      },
      // Extended 1.5-hour seminar (15:00-16:30) - with all fields
      {
        subject: 'Engineering Ethics Seminar',
        subjectCode: 'ETH201',
        teacher: 'Prof. Wilson',
        room: 'Seminar Hall',
        type: 'Seminar',
        timeSlot: { startTime: '15:00', endTime: '16:30' },
        day: 'Wednesday',
        weekType: 'All',
        color: '#EC4899'
      },
      // Regular 50-minute class (11:00-11:50) - with some optional fields
      {
        subject: 'Digital Logic Design',
        subjectCode: 'DIG201',
        room: 'Room 301',
        type: 'Lecture',
        timeSlot: { startTime: '11:00', endTime: '11:50' },
        day: 'Thursday',
        weekType: 'All',
        color: '#06B6D4'
      }
    ];
    
    // Add each class using the model's addClass method
    for (const classData of sampleClasses) {
      personalTimetable.addClass(classData);
    }
    
    // Save the timetable
    await personalTimetable.save();
    
    console.log('✅ Sample timetable created/updated successfully!');
    console.log('📅 Added 7 sample classes with flexible time slots:');
    console.log('   • Monday: 3 classes (including 2-hour Physics Lab)');
    console.log('   • Tuesday: 2 classes (including 2-hour Programming Lab)');
    console.log('   • Wednesday: 1 class (1.5-hour Ethics Seminar)');
    console.log('   • Thursday: 1 class (50-minute Digital Logic)');
    console.log('👤 Timetable belongs to:', adminUser.email);
    console.log('💡 Demonstrates flexible time slots and optional fields:');
    console.log('   • Regular classes: 50 minutes');
    console.log('   • Extended labs: 2 hours');
    console.log('   • Seminars: 1.5 hours');
    console.log('   • Optional fields: Subject Code, Teacher, Room');
    console.log('   • Some classes have minimal info, others are fully detailed');
    console.log('🔧 You can now edit, add, or remove classes with flexible durations');
    
  } catch (error) {
    console.error('❌ Error creating sample timetable:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createSampleTimetable();
