const express = require('express');
const Timetable = require('../models/Timetable');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/timetable/:branch/:year
// @desc    Get timetable for a specific branch and year
// @access  Private
router.get('/:branch/:year', auth, async (req, res) => {
  try {
    const { branch, year } = req.params;
    const { semester, academicYear } = req.query;

    const query = { branch, year: parseInt(year), isActive: true };
    
    if (semester) query.semester = parseInt(semester);
    if (academicYear) query.academicYear = academicYear;

    const timetable = await Timetable.findOne(query).populate('createdBy', 'name email');

    if (!timetable) {
      return res.status(404).json({
        error: 'Timetable not found',
        message: `No timetable found for ${branch} ${year} year`
      });
    }

    res.json({
      timetable,
      message: 'Timetable retrieved successfully'
    });

  } catch (error) {
    console.error('Timetable fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch timetable',
      message: error.message
    });
  }
});

// @route   GET /api/timetable/:branch/:year/daily/:day
// @desc    Get classes for a specific day
// @access  Private
router.get('/:branch/:year/daily/:day', auth, async (req, res) => {
  try {
    const { branch, year, day } = req.params;
    const { semester, academicYear } = req.query;

    const query = { branch, year: parseInt(year), isActive: true };
    
    if (semester) query.semester = parseInt(semester);
    if (academicYear) query.academicYear = academicYear;

    const timetable = await Timetable.findOne(query);
    
    if (!timetable) {
      return res.status(404).json({
        error: 'Timetable not found',
        message: `No timetable found for ${branch} ${year} year`
      });
    }

    const dayClasses = timetable.getClassesForDay(day);
    const freeSlots = timetable.getFreeSlots(day);

    res.json({
      day,
      classes: dayClasses,
      freeSlots,
      totalClasses: dayClasses.length,
      totalFreeSlots: freeSlots.length,
      message: `Daily schedule for ${day} retrieved successfully`
    });

  } catch (error) {
    console.error('Daily timetable error:', error);
    res.status(500).json({
      error: 'Failed to fetch daily timetable',
      message: error.message
    });
  }
});

// @route   GET /api/timetable/:branch/:year/free-slots
// @desc    Get free slots for all days
// @access  Private
router.get('/:branch/:year/free-slots', auth, async (req, res) => {
  try {
    const { branch, year } = req.params;
    const { semester, academicYear } = req.query;

    const query = { branch, year: parseInt(year), isActive: true };
    
    if (semester) query.semester = parseInt(semester);
    if (academicYear) query.academicYear = academicYear;

    const timetable = await Timetable.findOne(query);
    
    if (!timetable) {
      return res.status(404).json({
        error: 'Timetable not found',
        message: `No timetable found for ${branch} ${year} year`
      });
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const freeSlotsByDay = {};

    days.forEach(day => {
      freeSlotsByDay[day] = timetable.getFreeSlots(day);
    });

    res.json({
      branch,
      year,
      freeSlotsByDay,
      message: 'Free slots retrieved successfully'
    });

  } catch (error) {
    console.error('Free slots error:', error);
    res.status(500).json({
      error: 'Failed to fetch free slots',
      message: error.message
    });
  }
});

// @route   GET /api/timetable/:branch/:year/workload
// @desc    Get workload analysis for a branch and year
// @access  Private
router.get('/:branch/:year/workload', auth, async (req, res) => {
  try {
    const { branch, year } = req.params;
    const { semester, academicYear } = req.query;

    const query = { branch, year: parseInt(year), isActive: true };
    
    if (semester) query.semester = parseInt(semester);
    if (academicYear) query.academicYear = academicYear;

    const timetable = await Timetable.findOne(query);
    
    if (!timetable) {
      return res.status(404).json({
        error: 'Timetable not found',
        message: `No timetable found for ${branch} ${year} year`
      });
    }

    // Calculate workload metrics
    const totalClasses = timetable.classes.length;
    const classesByDay = {};
    const classesByType = {};
    const classesBySubject = {};

    timetable.classes.forEach(cls => {
      // Count by day
      classesByDay[cls.day] = (classesByDay[cls.day] || 0) + 1;
      
      // Count by type
      classesByType[cls.type] = (classesByType[cls.type] || 0) + 1;
      
      // Count by subject
      classesBySubject[cls.subject] = (classesBySubject[cls.subject] || 0) + 1;
    });

    // Calculate average classes per day
    const daysWithClasses = Object.keys(classesByDay).length;
    const avgClassesPerDay = daysWithClasses > 0 ? (totalClasses / daysWithClasses).toFixed(1) : 0;

    // Find busiest and lightest days
    const sortedDays = Object.entries(classesByDay).sort(([,a], [,b]) => b - a);
    const busiestDay = sortedDays[0] ? { day: sortedDays[0][0], classes: sortedDays[0][1] } : null;
    const lightestDay = sortedDays[sortedDays.length - 1] ? { day: sortedDays[sortedDays.length - 1][0], classes: sortedDays[sortedDays.length - 1][1] } : null;

    res.json({
      branch,
      year,
      workload: {
        totalClasses,
        avgClassesPerDay: parseFloat(avgClassesPerDay),
        classesByDay,
        classesByType,
        classesBySubject,
        busiestDay,
        lightestDay,
        totalSubjects: Object.keys(classesBySubject).length
      },
      message: 'Workload analysis retrieved successfully'
    });

  } catch (error) {
    console.error('Workload analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze workload',
      message: error.message
    });
  }
});

// @route   POST /api/timetable
// @desc    Create a new timetable (Admin only)
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { branch, year, semester, academicYear, classes } = req.body;

    // Check if timetable already exists
    const existingTimetable = await Timetable.findOne({
      branch,
      year,
      semester,
      academicYear,
      isActive: true
    });

    if (existingTimetable) {
      return res.status(400).json({
        error: 'Timetable already exists',
        message: `A timetable for ${branch} ${year} year, semester ${semester} already exists`
      });
    }

    // Create new timetable
    const timetable = new Timetable({
      branch,
      year,
      semester,
      academicYear,
      classes,
      createdBy: req.user.userId
    });

    await timetable.save();

    res.status(201).json({
      message: 'Timetable created successfully',
      timetable
    });

  } catch (error) {
    console.error('Timetable creation error:', error);
    res.status(500).json({
      error: 'Failed to create timetable',
      message: error.message
    });
  }
});

// @route   PUT /api/timetable/:id
// @desc    Update an existing timetable
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const timetable = await Timetable.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!timetable) {
      return res.status(404).json({
        error: 'Timetable not found',
        message: 'Timetable does not exist'
      });
    }

    res.json({
      message: 'Timetable updated successfully',
      timetable
    });

  } catch (error) {
    console.error('Timetable update error:', error);
    res.status(500).json({
      error: 'Failed to update timetable',
      message: error.message
    });
  }
});

// @route   DELETE /api/timetable/:id
// @desc    Deactivate a timetable
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const timetable = await Timetable.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!timetable) {
      return res.status(404).json({
        error: 'Timetable not found',
        message: 'Timetable does not exist'
      });
    }

    res.json({
      message: 'Timetable deactivated successfully',
      timetable
    });

  } catch (error) {
    console.error('Timetable deactivation error:', error);
    res.status(500).json({
      error: 'Failed to deactivate timetable',
      message: error.message
    });
  }
});

module.exports = router; 