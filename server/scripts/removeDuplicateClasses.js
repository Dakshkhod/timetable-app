const mongoose = require('mongoose');
const PersonalTimetable = require('../models/PersonalTimetable');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-timetable', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function removeDuplicateClasses() {
  try {
    console.log('🔍 Looking for duplicate classes in personal timetables...');
    
    // Find all personal timetables
    const personalTimetables = await PersonalTimetable.find({});
    
    if (personalTimetables.length === 0) {
      console.log('📭 No personal timetables found');
      return;
    }
    
    let totalDuplicatesRemoved = 0;
    
    for (const timetable of personalTimetables) {
      console.log(`\n👤 Processing timetable for user: ${timetable.userId}`);
      console.log(`   Branch: ${timetable.branch}, Year: ${timetable.year}`);
      console.log(`   Total classes: ${timetable.classes.length}`);
      
      // Group classes by subject, day, and time to find duplicates
      const classGroups = {};
      
      timetable.classes.forEach(cls => {
        const key = `${cls.subject}-${cls.day}-${cls.timeSlot.startTime}-${cls.timeSlot.endTime}`;
        if (!classGroups[key]) {
          classGroups[key] = [];
        }
        classGroups[key].push(cls);
      });
      
      // Find and remove duplicates
      let duplicatesRemoved = 0;
      const updatedClasses = [];
      
      Object.values(classGroups).forEach(group => {
        if (group.length > 1) {
          console.log(`   ⚠️  Found ${group.length} duplicate(s) for: ${group[0].subject} on ${group[0].day} at ${group[0].timeSlot.startTime}-${group[0].timeSlot.endTime}`);
          
          // Keep the first one, remove the rest
          updatedClasses.push(group[0]);
          duplicatesRemoved += group.length - 1;
        } else {
          updatedClasses.push(group[0]);
        }
      });
      
      if (duplicatesRemoved > 0) {
        timetable.classes = updatedClasses;
        await timetable.save();
        console.log(`   ✅ Removed ${duplicatesRemoved} duplicate(s)`);
        totalDuplicatesRemoved += duplicatesRemoved;
      } else {
        console.log(`   ✅ No duplicates found`);
      }
    }
    
    console.log(`\n🎉 Summary:`);
    console.log(`   Total duplicates removed: ${totalDuplicatesRemoved}`);
    console.log(`   Personal timetables processed: ${personalTimetables.length}`);
    
    if (totalDuplicatesRemoved > 0) {
      console.log('\n💡 Duplicate classes have been removed from all personal timetables');
      console.log('   Users can now see their cleaned schedules');
    } else {
      console.log('\n💡 No duplicate classes were found');
    }
    
  } catch (error) {
    console.error('❌ Error removing duplicate classes:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

removeDuplicateClasses();
