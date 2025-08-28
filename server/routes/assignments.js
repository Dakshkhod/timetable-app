const express = require('express');
const Assignment = require('../models/Assignment');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/assignments
// @desc    Get all assignments for the authenticated user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const assignments = await Assignment.find({ 
      userId: req.user.userId 
    }).sort({ dueDate: 1 });

    res.json({
      assignments,
      message: 'Assignments retrieved successfully'
    });

  } catch (error) {
    console.error('Assignments fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch assignments',
      message: error.message
    });
  }
});

// @route   POST /api/assignments
// @desc    Create a new assignment
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { title, subject, dueDate, description, priority, estimatedHours } = req.body;

    const assignment = new Assignment({
      title,
      subject,
      dueDate,
      description,
      priority: priority || 'Medium',
      estimatedHours: estimatedHours || 2,
      userId: req.user.userId
    });

    await assignment.save();

    res.status(201).json({
      message: 'Assignment created successfully',
      assignment
    });

  } catch (error) {
    console.error('Assignment creation error:', error);
    res.status(500).json({
      error: 'Failed to create assignment',
      message: error.message
    });
  }
});

// @route   PUT /api/assignments/:id
// @desc    Update an assignment
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const assignment = await Assignment.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!assignment) {
      return res.status(404).json({
        error: 'Assignment not found',
        message: 'Assignment does not exist or you do not have permission to update it'
      });
    }

    res.json({
      message: 'Assignment updated successfully',
      assignment
    });

  } catch (error) {
    console.error('Assignment update error:', error);
    res.status(500).json({
      error: 'Failed to update assignment',
      message: error.message
    });
  }
});

// @route   DELETE /api/assignments/:id
// @desc    Delete an assignment
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findOneAndDelete({
      _id: id,
      userId: req.user.userId
    });

    if (!assignment) {
      return res.status(404).json({
        error: 'Assignment not found',
        message: 'Assignment does not exist or you do not have permission to delete it'
      });
    }

    res.json({
      message: 'Assignment deleted successfully'
    });

  } catch (error) {
    console.error('Assignment deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete assignment',
      message: error.message
    });
  }
});

// @route   GET /api/assignments/upcoming
// @desc    Get upcoming assignments (next 7 days)
// @access  Private
router.get('/upcoming', auth, async (req, res) => {
  try {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const assignments = await Assignment.find({
      userId: req.user.userId,
      dueDate: {
        $gte: new Date(),
        $lte: sevenDaysFromNow
      },
      status: { $ne: 'Completed' }
    }).sort({ dueDate: 1 });

    res.json({
      assignments,
      message: 'Upcoming assignments retrieved successfully'
    });

  } catch (error) {
    console.error('Upcoming assignments error:', error);
    res.status(500).json({
      error: 'Failed to fetch upcoming assignments',
      message: error.message
    });
  }
});

module.exports = router;