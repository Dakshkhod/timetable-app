const mongoose = require('mongoose');
const PersonalTimetable = require('../models/PersonalTimetable');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-timetable', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function removeSpecificClasses() {
  try {
    console.log('🔍 Looking for specific classes to remove from personal timetables...');
    
    // Configuration - modify these values as needed
    const classesToRemove = [
      {
        subject: 'IAM',
        day: 'Monday',
        startTime: '21:00',
        endTime: '21:50'
      }
      // Add more specific classes here if needed
      // {
      //   subject: 'Subject Name',
      //   day: 'Day',
      //   startTime: 'HH:MM',
      //   endTime: 'HH:MM'
      // }
    ];
    
    console.log('🎯 Classes to remove:');
    classesToRemove.forEach(cls => {
      console.log(`   - ${cls.subject} on ${cls.day} at ${cls.startTime}-${cls.endTime}`);
    });
    
    // Find all personal timetables
    const personalTimetables = await PersonalTimetable.find({});
    
    if (personalTimetables.length === 0) {
      console.log('📭 No personal timetables found');
      return;
    }
    
    let totalClassesRemoved = 0;
    
    for (const timetable of personalTimetables) {
      console.log(`\n👤 Processing timetable for user: ${timetable.userId}`);
      console.log(`   Branch: ${timetable.branch}, Year: ${timetable.year}`);
      console.log(`   Total classes before: ${timetable.classes.length}`);
      
      let classesRemoved = 0;
      const updatedClasses = [];
      
      timetable.classes.forEach(cls => {
        let shouldRemove = false;
        
        // Check if this class matches any of the classes to remove
        classesToRemove.forEach(targetClass => {
          if (cls.subject === targetClass.subject &&
              cls.day === targetClass.day &&
              cls.timeSlot.startTime === targetClass.startTime &&
              cls.timeSlot.endTime === targetClass.endTime) {
            shouldRemove = true;
            console.log(`   🗑️  Removing: ${cls.subject} on ${cls.day} at ${cls.timeSlot.startTime}-${cls.timeSlot.endTime}`);
          }
        });
        
        if (!shouldRemove) {
          updatedClasses.push(cls);
        } else {
          classesRemoved++;
        }
      });
      
      if (classesRemoved > 0) {
        timetable.classes = updatedClasses;
        await timetable.save();
        console.log(`   ✅ Removed ${classesRemoved} class(es)`);
        totalClassesRemoved += classesRemoved;
      } else {
        console.log(`   ✅ No matching classes found`);
      }
      
      console.log(`   Total classes after: ${timetable.classes.length}`);
    }
    
    console.log(`\n🎉 Summary:`);
    console.log(`   Total classes removed: ${totalClassesRemoved}`);
    console.log(`   Personal timetables processed: ${personalTimetables.length}`);
    
    if (totalClassesRemoved > 0) {
      console.log('\n💡 Specified classes have been removed from all personal timetables');
      console.log('   Users can now see their cleaned schedules');
    } else {
      console.log('\n💡 No matching classes were found to remove');
    }
    
  } catch (error) {
    console.error('❌ Error removing specific classes:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

removeSpecificClasses();
