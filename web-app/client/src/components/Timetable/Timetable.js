import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Edit, 
  Trash2, 
  
  Clock, 
  MapPin, 
  User, 
  BookOpen,
  Settings,
  LogOut
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import AddEditClassModal from './AddEditClassModal';
import TimetablePreferences from './TimetablePreferences';

const Timetable = () => {
  const { isAuthenticated, logout } = useAuth();
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const queryClient = useQueryClient();

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Fetch user's personalized timetable
  const { data: timetableData, isLoading, error } = useQuery(
    'userTimetable',
    async () => {
      const response = await api.get('/api/user-timetable/my');
      return response.data;
    },
    {
      enabled: isAuthenticated, // Only run query if user is authenticated
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Mutations for timetable operations
  const addClassMutation = useMutation(
    async (classData) => {
      const response = await api.post('/api/user-timetable/class', classData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('userTimetable');
        toast.success('Class added successfully!');
        setShowAddModal(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add class');
      }
    }
  );

  const updateClassMutation = useMutation(
    async ({ classId, updates }) => {
      const response = await api.put(`/api/user-timetable/class/${classId}`, updates);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('userTimetable');
        toast.success('Class updated successfully!');
        setShowAddModal(false);
        setEditingClass(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update class');
      }
    }
  );

  const deleteClassMutation = useMutation(
    async (classId) => {
      const response = await api.delete(`/api/user-timetable/class/${classId}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('userTimetable');
        toast.success('Class removed successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to remove class');
      }
    }
  );

  const toggleVisibilityMutation = useMutation(
    async (classId) => {
      const response = await api.post(`/api/user-timetable/toggle-visibility/${classId}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('userTimetable');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to toggle visibility');
      }
    }
  );

  // Stabilize functions to prevent unnecessary re-renders
  const handleAddClass = useCallback((classData) => {
    addClassMutation.mutate(classData);
  }, [addClassMutation]);

  const handleEditClass = useCallback((classData) => {
    if (editingClass) {
      updateClassMutation.mutate({
        classId: editingClass._id,
        updates: classData
      });
    }
  }, [editingClass, updateClassMutation]);

  // Create a stable onSubmit function that handles both add and edit
  const handleSubmit = useCallback((classData) => {
    if (editingClass) {
      handleEditClass(classData);
    } else {
      handleAddClass(classData);
    }
  }, [editingClass, handleEditClass, handleAddClass]);

  const handleDeleteClass = useCallback((classId) => {
    if (window.confirm('Are you sure you want to remove this class?')) {
      deleteClassMutation.mutate(classId);
    }
  }, [deleteClassMutation]);

  const handleToggleVisibility = useCallback((classId) => {
    toggleVisibilityMutation.mutate(classId);
  }, [toggleVisibilityMutation]);

  const closeModal = useCallback(() => {
    setShowAddModal(false);
    setEditingClass(null);
  }, []);

  const openAddModal = useCallback((day, slot = null) => {
    setSelectedDay(day);
    setEditingClass(null);
    setShowAddModal(true);
    
    // If a slot is provided, we'll pass it to the modal for pre-filling
    if (slot) {
      // Store the slot data temporarily to pass to the modal
      setEditingClass({
        isNewClass: true,
        day: day,
        timeSlot: {
          startTime: slot.start,
          endTime: slot.end
        }
      });
    }
  }, []);

  const openEditModal = useCallback((cls) => {
    setEditingClass(cls);
    setShowAddModal(true);
  }, []);

  // Get classes for selected day
  const getDayClasses = () => {
    if (!timetableData?.timetable?.classes) return [];
    return timetableData.timetable.classes.filter(cls => cls.day === selectedDay);
  };

  // Get free slots for selected day
  const getFreeSlots = () => {
    if (!timetableData?.timetable?.classes) return [];
    
    const dayClasses = timetableData.timetable.classes.filter(cls => cls.day === selectedDay);
    
    // Define working hours (8 AM to 6 PM)
    const workingHours = [
      { start: '08:00', end: '08:50' },
      { start: '09:00', end: '09:50' },
      { start: '10:00', end: '10:50' },
      { start: '11:00', end: '11:50' },
      { start: '12:00', end: '12:50' },
      { start: '13:00', end: '13:50' },
      { start: '14:00', end: '14:50' },
      { start: '15:00', end: '15:50' },
      { start: '16:00', end: '16:50' },
      { start: '17:00', end: '17:50' },
      { start: '18:00', end: '18:50' }
    ];

    // Filter out time slots that conflict with existing classes
    const freeSlots = workingHours.filter(slot => {
      const hasConflict = dayClasses.some(cls => {
        const classStart = cls.timeSlot.startTime;
        const classEnd = cls.timeSlot.endTime;
        
        // Check if the slot overlaps with any class
        return (
          (slot.start >= classStart && slot.start < classEnd) ||
          (slot.end > classStart && slot.end <= classEnd) ||
          (slot.start <= classStart && slot.end >= classEnd)
        );
      });
      
      return !hasConflict;
    });

    return freeSlots;
  };

  // Show loading if not authenticated yet
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Timetable</h2>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  const dayClasses = getDayClasses();
  const freeSlots = getFreeSlots();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Timetable</h1>
          <p className="text-gray-600">
            {timetableData?.timetable?.branch} - Year {timetableData?.timetable?.year}
          </p>
          <div className="mt-2">
            <button
              onClick={() => window.location.href = '/timetable/edit'}
              className="text-sm text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
            >
              <Edit className="w-3 h-3" />
              Switch to Grid Editor
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button
            onClick={() => setShowPreferences(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Preferences
          </button>
          <button
            onClick={() => window.location.href = '/timetable/edit'}
            className="btn btn-accent flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Grid
          </button>
          <button
            onClick={() => openAddModal(selectedDay)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Class
          </button>
          
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to logout?')) {
                logout();
              }
            }}
            className="btn btn-outline flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Day Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedDay === day
                ? 'bg-primary text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Timetable Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classes */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Classes for {selectedDay}
          </h2>
          
          {dayClasses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No classes scheduled for {selectedDay}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dayClasses.map((cls) => (
                <motion.div
                  key={cls._id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-4 rounded-lg border-l-4 border-primary bg-blue-50 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{cls.subject}</h3>
                      <p className="text-sm text-gray-600">{cls.subjectCode}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(cls)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        title="Edit class"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClass(cls._id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="Remove class"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>{cls.timeSlot.startTime} - {cls.timeSlot.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span>{cls.room}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span>{cls.teacher}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-gray-500" />
                      <span className="capitalize">{cls.type}</span>
                    </div>
                  </div>
                  

                </motion.div>
              ))}
            </div>
          )}
        </div>

                          {/* Free Slots */}
         <div className="bg-white rounded-xl shadow-lg p-6">
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
               <Clock className="w-5 h-5 text-green-600" />
               Free Time Slots
               <span className="text-xs text-gray-500 font-normal">(calculated in real-time)</span>
             </h2>
                           <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {freeSlots.length} slots • {freeSlots.length * 50} min • {(freeSlots.length * 50 / 60).toFixed(1)} hrs
              </span>
           </div>
           
           {freeSlots.length === 0 ? (
             <div className="text-center py-8 text-gray-500">
               <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
               <p>No free slots available on {selectedDay}</p>
               <p className="text-sm mt-2">All time slots are occupied by classes</p>
               <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                 <p className="text-sm text-blue-700">
                   💡 <strong>Tip:</strong> You can remove some classes to free up time slots, or switch to a different day
                 </p>
               </div>
             </div>
           ) : (
             <div className="space-y-3">
               {freeSlots.length > 5 && (
                 <div className="text-center py-2 text-sm text-green-600 bg-green-100 rounded-lg mb-3">
                   🎉 You have {freeSlots.length} free time slots available! 
                   <br />
                   <span className="text-xs">
                     Total free time: {(freeSlots.length * 50 / 60).toFixed(1)} hours
                   </span>
                 </div>
               )}
               {freeSlots.map((slot, index) => (
                 <motion.div
                   key={index}
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: index * 0.1 }}
                   className="p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors cursor-pointer"
                   onClick={() => openAddModal(selectedDay, slot)}
                 >
                   <div className="flex items-center justify-between">
                     <span className="font-medium text-green-800">
                       {slot.start} - {slot.end}
                     </span>
                     <span className="text-sm text-green-600 bg-green-200 px-2 py-1 rounded-full">
                       50 min (0.8 hrs)
                     </span>
                   </div>
                   <div className="mt-2 text-xs text-green-600">
                     Click to add a class during this time
                   </div>
                 </motion.div>
               ))}
             </div>
           )}
         </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddEditClassModal
          isOpen={showAddModal}
          onClose={closeModal}
          onSubmit={handleSubmit}
          editingClass={editingClass}
          selectedDay={selectedDay}
        />
      )}

      {showPreferences && (
        <TimetablePreferences
          isOpen={showPreferences}
          onClose={() => setShowPreferences(false)}
          preferences={timetableData?.preferences}
        />
      )}
    </div>
  );
};

export default Timetable; 