const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-timetable', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Create admin users for each branch
const adminUsers = [
  {
    name: 'Admin User',
    email: 'admin@college.edu',
    password: 'admin123',
    branch: 'Material and Metallurgical Engineering',
    year: 2,
    rollNumber: 'ADMIN001',
    role: 'admin'
  },
  {
    name: 'CS Admin',
    email: 'cs@college.edu',
    password: 'admin123',
    branch: 'Computer Science',
    year: 2,
    rollNumber: 'ADMIN002',
    role: 'admin'
  },
  {
    name: 'ME Admin',
    email: 'me@college.edu',
    password: 'admin123',
    branch: 'Mechanical',
    year: 2,
    rollNumber: 'ADMIN003',
    role: 'admin'
  },
  {
    name: 'EE Admin',
    email: 'ee@college.edu',
    password: 'admin123',
    branch: 'Electrical',
    year: 2,
    rollNumber: 'ADMIN004',
    role: 'admin'
  },
  {
    name: 'CE Admin',
    email: 'ce@college.edu',
    password: 'admin123',
    branch: 'Civil',
    year: 2,
    rollNumber: 'ADMIN005',
    role: 'admin'
  },
  {
    name: 'ChE Admin',
    email: 'che@college.edu',
    password: 'admin123',
    branch: 'Chemical',
    year: 2,
    rollNumber: 'ADMIN006',
    role: 'admin'
  },
  {
    name: 'ECE Admin',
    email: 'ece@college.edu',
    password: 'admin123',
    branch: 'Electronics',
    year: 2,
    rollNumber: 'ADMIN007',
    role: 'admin'
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Clear existing users
    await User.deleteMany({});
    console.log('🗑️  Cleared existing users');
    
    // Create admin users individually to ensure password hashing
    const createdUsers = [];
    for (const userData of adminUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`👤 Created user: ${user.email}`);
    }
    console.log(`👥 Created ${createdUsers.length} admin users`);
    
    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Sample data created:');
    console.log('- Admin users for each branch');
    console.log('- NO fixed timetables (users start with blank slate)');
    console.log('\n🔑 Login credentials:');
    adminUsers.forEach(user => {
      console.log(`   ${user.branch}: ${user.email} / admin123`);
    });
    
    console.log('\n💡 Users can now:');
    console.log('   1. Login with any branch admin account');
    console.log('   2. Start with a completely blank timetable');
    console.log('   3. Create their own personalized schedule from scratch');
    console.log('   4. Add/remove classes as they wish');
    console.log('   5. Have complete freedom to design their timetable');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

seedDatabase(); 