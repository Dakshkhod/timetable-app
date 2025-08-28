const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Task schema (embedded in User model for simplicity, but could be separate)
// We'll add tasks to User model or create a separate Task model

// @route   GET /api/planner/tasks
// @desc    Get user's planner tasks
// @access  Private
router.get('/tasks', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let tasks = user.plannerTasks || [];

    // Filter by date range if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      tasks = tasks.filter(task => {
        const taskDate = new Date(task.dueDate);
        return taskDate >= start && taskDate <= end;
      });
    }

    res.json({
      tasks: tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
      message: 'Tasks retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching planner tasks:', error);
    res.status(500).json({
      error: 'Failed to fetch tasks',
      message: error.message
    });
  }
});

// @route   POST /api/planner/tasks
// @desc    Add a new planner task
// @access  Private
router.post('/tasks', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      title,
      description,
      dueDate,
      priority = 'medium',
      category = 'study',
      estimatedTime = 60,
      status = 'pending',
      isRecurring = false,
      recurringPattern = 'daily'
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    const newTask = {
      _id: new Date().getTime().toString(), // Simple ID generation
      title: title.trim(),
      description: description?.trim() || '',
      dueDate: new Date(dueDate),
      priority,
      category,
      estimatedTime: parseInt(estimatedTime) || 60,
      status,
      isRecurring,
      recurringPattern,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        $push: { plannerTasks: newTask },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(201).json({
      task: newTask,
      message: 'Task added successfully'
    });
  } catch (error) {
    console.error('Error adding planner task:', error);
    res.status(500).json({
      error: 'Failed to add task',
      message: error.message
    });
  }
});

// @route   PUT /api/planner/tasks/:taskId
// @desc    Update a planner task
// @access  Private
router.put('/tasks/:taskId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { taskId } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.createdAt;
    
    // Add updated timestamp
    updates.updatedAt = new Date();

    // If dueDate is being updated, ensure it's a proper Date object
    if (updates.dueDate) {
      updates.dueDate = new Date(updates.dueDate);
    }

    const user = await User.findOneAndUpdate(
      { 
        _id: userId,
        'plannerTasks._id': taskId
      },
      {
        $set: Object.keys(updates).reduce((acc, key) => {
          acc[`plannerTasks.$.${key}`] = updates[key];
          return acc;
        }, {})
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const updatedTask = user.plannerTasks.find(task => task._id === taskId);

    res.json({
      task: updatedTask,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Error updating planner task:', error);
    res.status(500).json({
      error: 'Failed to update task',
      message: error.message
    });
  }
});

// @route   DELETE /api/planner/tasks/:taskId
// @desc    Delete a planner task
// @access  Private
router.delete('/tasks/:taskId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { taskId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        $pull: { plannerTasks: { _id: taskId } },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting planner task:', error);
    res.status(500).json({
      error: 'Failed to delete task',
      message: error.message
    });
  }
});

// @route   GET /api/planner/stats
// @desc    Get planner statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const tasks = user.plannerTasks || [];
    const now = new Date();
    
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => new Date(t.dueDate) < now && t.status === 'pending').length,
      highPriority: tasks.filter(t => t.priority === 'high').length,
      mediumPriority: tasks.filter(t => t.priority === 'medium').length,
      lowPriority: tasks.filter(t => t.priority === 'low').length,
      byCategory: {
        study: tasks.filter(t => t.category === 'study').length,
        assignment: tasks.filter(t => t.category === 'assignment').length,
        exam: tasks.filter(t => t.category === 'exam').length,
        personal: tasks.filter(t => t.category === 'personal').length
      },
      totalEstimatedTime: tasks
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + (t.estimatedTime || 0), 0)
    };

    res.json({
      stats,
      message: 'Statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching planner stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

// @route   POST /api/planner/sync-classroom
// @desc    Sync Google Classroom assignments to planner
// @access  Private
router.post('/sync-classroom', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.googleAuth?.isConnected) {
      return res.status(400).json({ 
        message: 'Google Classroom not connected' 
      });
    }

    // This would integrate with the Google Classroom service
    // For now, we'll just return a success message
    // In a full implementation, you'd:
    // 1. Fetch assignments from Google Classroom
    // 2. Convert them to planner tasks
    // 3. Avoid duplicates
    // 4. Update the user's plannerTasks

    res.json({
      message: 'Classroom sync completed',
      synced: 0 // Would be actual count
    });
  } catch (error) {
    console.error('Error syncing classroom:', error);
    res.status(500).json({
      error: 'Failed to sync classroom',
      message: error.message
    });
  }
});

module.exports = router;
