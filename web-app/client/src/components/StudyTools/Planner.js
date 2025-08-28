import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  
  Plus,
  Edit,
  Trash2,
  Clock,
  Flag,
  CheckCircle,
  Circle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  BookOpen,
  AlertTriangle,
  Target,
  Star,
  CalendarDays
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, addWeeks, subWeeks, addDays, startOfDay, endOfDay } from 'date-fns';
import api from '../../services/api';

const Planner = () => {
  const [view, setView] = useState('week'); // 'day', 'week', 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'completed', 'high', 'medium', 'low'
  const [searchTerm, setSearchTerm] = useState('');
  
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    dueTime: '',
    priority: 'medium',
    category: 'study',
    estimatedTime: 60, // in minutes
    isRecurring: false,
    recurringPattern: 'daily'
  });

  const queryClient = useQueryClient();

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery(
    ['plannerTasks', currentDate],
    async () => {
      const startDate = view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : 
                       view === 'day' ? startOfDay(currentDate) : 
                       new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      const endDate = view === 'week' ? endOfWeek(currentDate, { weekStartsOn: 1 }) : 
                     view === 'day' ? endOfDay(currentDate) : 
                     new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const response = await api.get('/api/planner/tasks', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
      return response.data.tasks || [];
    },
    {
      staleTime: 30000, // 30 seconds
      refetchInterval: 60000 // 1 minute
    }
  );

  // Fetch Google Classroom assignments for integration
  const { data: classroomAssignments = [] } = useQuery(
    'classroomAssignments',
    async () => {
      try {
        const response = await api.get('/api/google/assignments');
        return response.data.assignments || [];
      } catch (error) {
        console.log('No classroom integration available');
        return [];
      }
    },
    {
      staleTime: 300000, // 5 minutes
      retry: false
    }
  );

  // Add task mutation
  const addTaskMutation = useMutation(
    async (taskData) => {
      const response = await api.post('/api/planner/tasks', taskData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['plannerTasks']);
        toast.success('Task added successfully!');
        setShowAddTask(false);
        resetTaskForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add task');
      }
    }
  );

  // Update task mutation
  const updateTaskMutation = useMutation(
    async ({ taskId, updates }) => {
      const response = await api.put(`/api/planner/tasks/${taskId}`, updates);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['plannerTasks']);
        toast.success('Task updated successfully!');
        setEditingTask(null);
        resetTaskForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update task');
      }
    }
  );

  // Delete task mutation
  const deleteTaskMutation = useMutation(
    async (taskId) => {
      await api.delete(`/api/planner/tasks/${taskId}`);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['plannerTasks']);
        toast.success('Task deleted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete task');
      }
    }
  );

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      description: '',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      dueTime: '',
      priority: 'medium',
      category: 'study',
      estimatedTime: 60,
      isRecurring: false,
      recurringPattern: 'daily'
    });
  };

  const handleAddTask = () => {
    if (!taskForm.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    const dueDateTime = taskForm.dueTime ? 
      new Date(`${taskForm.dueDate}T${taskForm.dueTime}`) : 
      new Date(taskForm.dueDate);

    addTaskMutation.mutate({
      ...taskForm,
      dueDate: dueDateTime,
      status: 'pending'
    });
  };

  const handleUpdateTask = () => {
    if (!taskForm.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    const dueDateTime = taskForm.dueTime ? 
      new Date(`${taskForm.dueDate}T${taskForm.dueTime}`) : 
      new Date(taskForm.dueDate);

    updateTaskMutation.mutate({
      taskId: editingTask._id,
      updates: {
        ...taskForm,
        dueDate: dueDateTime
      }
    });
  };

  const toggleTaskStatus = (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTaskMutation.mutate({
      taskId: task._id,
      updates: { status: newStatus }
    });
  };

  const startEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      dueDate: format(new Date(task.dueDate), 'yyyy-MM-dd'),
      dueTime: format(new Date(task.dueDate), 'HH:mm'),
      priority: task.priority,
      category: task.category,
      estimatedTime: task.estimatedTime || 60,
      isRecurring: task.isRecurring || false,
      recurringPattern: task.recurringPattern || 'daily'
    });
    setShowAddTask(true);
  };

  const getFilteredTasks = () => {
    let filtered = tasks;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply status/priority filter
    switch (filter) {
      case 'pending':
        filtered = filtered.filter(task => task.status === 'pending');
        break;
      case 'completed':
        filtered = filtered.filter(task => task.status === 'completed');
        break;
      case 'high':
      case 'medium':
      case 'low':
        filtered = filtered.filter(task => task.priority === filter);
        break;
      default:
        break;
    }

    return filtered.sort((a, b) => {
      // Sort by due date, then by priority
      const dateA = new Date(a.dueDate);
      const dateB = new Date(b.dueDate);
      
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }
      
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'study': return BookOpen;
      case 'assignment': return Target;
      case 'exam': return AlertTriangle;
      case 'personal': return Star;
      default: return Circle;
    }
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({
      start,
      end: endOfWeek(currentDate, { weekStartsOn: 1 })
    });
  };

  const getTasksForDay = (date) => {
    return getFilteredTasks().filter(task => 
      isSameDay(new Date(task.dueDate), date)
    );
  };

  const navigateDate = (direction) => {
    if (view === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else if (view === 'day') {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : addDays(currentDate, -1));
    }
  };

  const isOverdue = (task) => {
    return new Date(task.dueDate) < new Date() && task.status !== 'completed';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Study Planner</h1>
          <p className="text-gray-600">Organize your tasks and deadlines</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddTask(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* View Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {['day', 'week'].map((viewType) => (
            <button
              key={viewType}
              onClick={() => setView(viewType)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === viewType 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
            </button>
          ))}
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input min-w-[120px]"
          >
            <option value="all">All Tasks</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateDate('prev')}
          className="btn btn-outline flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        
        <h2 className="text-xl font-semibold text-gray-900">
          {view === 'week' 
            ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
            : format(currentDate, 'EEEE, MMMM d, yyyy')
          }
        </h2>
        
        <button
          onClick={() => navigateDate('next')}
          className="btn btn-outline flex items-center gap-2"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar View */}
      {view === 'week' ? (
        <div className="grid grid-cols-7 gap-4">
          {getWeekDays().map((day) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentDay = isToday(day);
            
            return (
              <div
                key={day.toISOString()}
                className={`bg-white rounded-lg border p-4 min-h-[200px] ${
                  isCurrentDay ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className={`text-center mb-3 ${isCurrentDay ? 'text-blue-600' : 'text-gray-900'}`}>
                  <div className="font-semibold">{format(day, 'EEE')}</div>
                  <div className={`text-2xl font-bold ${isCurrentDay ? 'bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' : ''}`}>
                    {format(day, 'd')}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {dayTasks.map((task) => {
                    const CategoryIcon = getCategoryIcon(task.category);
                    const isTaskOverdue = isOverdue(task);
                    
                    return (
                      <motion.div
                        key={task._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-2 rounded border text-xs cursor-pointer hover:shadow-md transition-shadow ${
                          task.status === 'completed' 
                            ? 'bg-green-50 border-green-200 text-green-800' 
                            : isTaskOverdue
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : getPriorityColor(task.priority)
                        }`}
                        onClick={() => startEditTask(task)}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTaskStatus(task);
                            }}
                            className="mt-0.5"
                          >
                            {task.status === 'completed' ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <Circle className="w-3 h-3" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className={`font-medium ${task.status === 'completed' ? 'line-through' : ''}`}>
                              {task.title}
                            </div>
                            {task.dueTime && (
                              <div className="flex items-center gap-1 mt-1 opacity-75">
                                <Clock className="w-3 h-3" />
                                {format(new Date(task.dueDate), 'HH:mm')}
                              </div>
                            )}
                          </div>
                          <CategoryIcon className="w-3 h-3 opacity-60" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Day View */
        <div className="bg-white rounded-lg border">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tasks for {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            
            <div className="space-y-3">
              {getTasksForDay(currentDate).map((task) => {
                const CategoryIcon = getCategoryIcon(task.category);
                const isTaskOverdue = isOverdue(task);
                
                return (
                  <motion.div
                    key={task._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                      task.status === 'completed' 
                        ? 'bg-green-50 border-green-200' 
                        : isTaskOverdue
                        ? 'bg-red-50 border-red-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => startEditTask(task)}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskStatus(task);
                        }}
                        className="mt-1"
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      
                      <div className="flex-1">
                        <div className={`font-medium text-gray-900 ${task.status === 'completed' ? 'line-through' : ''}`}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-sm text-gray-600 mt-1">
                            {task.description}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          {task.dueTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {format(new Date(task.dueDate), 'HH:mm')}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            <Flag className="w-4 h-4" />
                            <span className="capitalize">{task.priority}</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <CategoryIcon className="w-4 h-4" />
                            <span className="capitalize">{task.category}</span>
                          </div>
                          
                          {task.estimatedTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {Math.floor(task.estimatedTime / 60)}h {task.estimatedTime % 60}m
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTaskMutation.mutate(task._id);
                        }}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
              
              {getTasksForDay(currentDate).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No tasks scheduled for this day</p>
                  <button
                    onClick={() => setShowAddTask(true)}
                    className="text-blue-600 hover:text-blue-800 mt-2"
                  >
                    Add your first task
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Task Modal */}
      <AnimatePresence>
        {showAddTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black bg-opacity-50"
              onClick={() => {
                setShowAddTask(false);
                setEditingTask(null);
                resetTaskForm();
              }}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {editingTask ? 'Edit Task' : 'Add New Task'}
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Task Title *
                    </label>
                    <input
                      type="text"
                      value={taskForm.title}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                      className="input"
                      placeholder="Enter task title..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={taskForm.description}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                      className="input"
                      rows="3"
                      placeholder="Add details about this task..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Due Date *
                      </label>
                      <input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, dueDate: e.target.value }))}
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Due Time
                      </label>
                      <input
                        type="time"
                        value={taskForm.dueTime}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, dueTime: e.target.value }))}
                        className="input"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <select
                        value={taskForm.priority}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value }))}
                        className="input"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={taskForm.category}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, category: e.target.value }))}
                        className="input"
                      >
                        <option value="study">Study</option>
                        <option value="assignment">Assignment</option>
                        <option value="exam">Exam</option>
                        <option value="personal">Personal</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Time (minutes)
                    </label>
                    <input
                      type="number"
                      min="15"
                      step="15"
                      value={taskForm.estimatedTime}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, estimatedTime: parseInt(e.target.value) || 60 }))}
                      className="input"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={editingTask ? handleUpdateTask : handleAddTask}
                    disabled={addTaskMutation.isLoading || updateTaskMutation.isLoading}
                    className="btn btn-primary flex-1"
                  >
                    {editingTask ? 'Update Task' : 'Add Task'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowAddTask(false);
                      setEditingTask(null);
                      resetTaskForm();
                    }}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border text-center">
          <div className="text-2xl font-bold text-blue-600">{tasks.filter(t => t.status === 'pending').length}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border text-center">
          <div className="text-2xl font-bold text-green-600">{tasks.filter(t => t.status === 'completed').length}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border text-center">
          <div className="text-2xl font-bold text-red-600">{tasks.filter(t => isOverdue(t)).length}</div>
          <div className="text-sm text-gray-600">Overdue</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border text-center">
          <div className="text-2xl font-bold text-purple-600">{tasks.filter(t => t.priority === 'high').length}</div>
          <div className="text-sm text-gray-600">High Priority</div>
        </div>
      </div>
    </div>
  );
};

export default Planner;
