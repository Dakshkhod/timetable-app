import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { } from 'framer-motion';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  X,
  
  
  
  BookOpen,
  
  Grid,
  LogOut
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import AddEditClassModal from './AddEditClassModal';

const EditableTimetable = () => {
  const { isAuthenticated, logout } = useAuth();
  const [editingCell, setEditingCell] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isActivelyEditing, setIsActivelyEditing] = useState(false);
  const editingDataRef = useRef({});
  const queryClient = useQueryClient();

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots = [
    '08:00-08:50', '09:00-09:50', '10:00-10:50', '11:00-11:50',
    '12:00-12:50', '13:00-13:50', '14:00-14:50', '15:00-15:50',
    '16:00-16:50', '17:00-17:50', '18:00-18:50', '19:00-19:50'
  ];
  const startTimes = timeSlots.map((slot) => slot.split('-')[0]);
  const endTimes = timeSlots.map((slot) => slot.split('-')[1]);

  // Fetch user's personalized timetable
  const { data: timetableData, isLoading, error } = useQuery(
    'userTimetable',
    async () => {
      const response = await api.get('/api/user-timetable/my');
      return response.data;
    },
    {
      enabled: isAuthenticated,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Update class mutation
  const updateClassMutation = useMutation(
    async ({ classId, updates }) => {
      const response = await api.put(`/api/user-timetable/class/${classId}`, updates);
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success('Class updated successfully!');
        setEditingCell(null);
        setEditingData({});
        setOriginalData({});
        setIsSaving(false);
        setIsTyping(false);
        // Delay the query invalidation to prevent form reset
        setTimeout(() => {
          queryClient.invalidateQueries('userTimetable');
        }, 100);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update class');
        setIsSaving(false);
        setIsTyping(false);
      }
    }
  );

  // Add custom class mutation
  const addClassMutation = useMutation(
    async (classData) => {
      const response = await api.post('/api/user-timetable/class', classData);
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success('Custom class added successfully!');
        setShowAddModal(false);
        setEditingCell(null);
        setEditingData({});
        setOriginalData({});
        setIsSaving(false);
        setIsTyping(false);
        // Delay the query invalidation to prevent form reset
        setTimeout(() => {
          queryClient.invalidateQueries('userTimetable');
        }, 100);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add class');
        setIsSaving(false);
        setIsTyping(false);
      }
    }
  );

  // Delete class mutation
  const deleteClassMutation = useMutation(
    async (classId) => {
      const response = await api.delete(`/api/user-timetable/class/${classId}`);
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success('Class removed successfully!');
        setEditingCell(null);
        setEditingData({});
        setOriginalData({});
        setIsSaving(false);
        setIsTyping(false);
        // Delay the query invalidation to prevent form reset
        setTimeout(() => {
          queryClient.invalidateQueries('userTimetable');
        }, 100);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to remove class');
        setIsSaving(false);
        setIsTyping(false);
      }
    }
  );

  // Monitor modal state changes
  useEffect(() => {
    console.log('🔍 Modal state changed:', { showAddModal });
  }, [showAddModal]);

  // Debug timetable data
  useEffect(() => {
    if (timetableData) {
      console.log('📅 Timetable data loaded:', timetableData);
      if (timetableData.timetable?.classes) {
        console.log('📚 All classes:', timetableData.timetable.classes);
        const geoClass = timetableData.timetable.classes.find(cls => cls.subject === 'Geo');
        if (geoClass) {
          console.log('🔍 Geo class found:', geoClass);
          console.log('🔍 Geo class day:', geoClass.day);
          console.log('🔍 Geo class time:', geoClass.timeSlot);
        }
      }
    }
  }, [timetableData]);

  // Get class at specific time and day
  const getClassAtTime = (timeSlot, day) => {
    if (!timetableData?.timetable?.classes) return null;
    
    // Parse the time slot (e.g., "08:00-08:50" -> startTime: "08:00", endTime: "08:50")
    const [startTime, endTime] = timeSlot.split('-');
    
    const foundClass = timetableData.timetable.classes.find(cls => {
      // Check if it's the same day
      if (cls.day !== day) return false;
      
      // Class starts at this exact start time OR this time slot falls within the class duration
      const classStart = cls.timeSlot.startTime;
      const classEnd = cls.timeSlot.endTime;
      
      // Check if this time slot is within the class duration
      const isClassAtTime = classStart === startTime || (startTime >= classStart && startTime < classEnd);
      
      if (isClassAtTime && cls.subject === 'Geo') {
        console.log(`🔍 Found Geo class at ${timeSlot} on ${day}: starts ${classStart}, ends ${classEnd}, isClassAtTime: ${isClassAtTime}`);
      }
      
      return isClassAtTime;
    });
    
    return foundClass;
  };

  // Handle cell click for editing
  const handleCellClick = (timeSlot, day) => {
    // Don't allow clicking on other cells while actively editing
    if (isActivelyEditing && editingCell) {
      console.log('🚫 Already actively editing, ignoring cell click');
      return;
    }

    // Parse the time slot to get start and end times
    const [startTime, endTime] = timeSlot.split('-');

    const existingClass = getClassAtTime(timeSlot, day);
    if (existingClass) {
      const classData = {
        subject: existingClass.subject || '',
        subjectCode: existingClass.subjectCode || '',
        teacher: existingClass.teacher || '',
        room: existingClass.room || '',
        type: existingClass.type,
        startTime: existingClass.timeSlot.startTime,
        endTime: existingClass.timeSlot.endTime,
        color: existingClass.color,
        isCustom: existingClass.isCustom || false, // Ensure this is properly set
        classId: existingClass._id,
        isBaseClass: !existingClass.isCustom // Add flag to identify base classes
      };
      setEditingCell({ time: timeSlot, day });
      setEditingData(classData);
      editingDataRef.current = classData;
      setOriginalData(classData);
      setIsActivelyEditing(false); // Reset active editing flag
      setShowSuccess(false);
      console.log('✅ Started editing class:', classData);
    } else {
      // Create new class
      const newClassData = {
        subject: '',
        subjectCode: '',
        teacher: '',
        room: '',
        type: 'Lecture',
        startTime: startTime,
        endTime: endTime,
        color: '#3B82F6',
        isCustom: true,
        classId: null,
        isBaseClass: false
      };
      setEditingCell({ time: timeSlot, day });
      setEditingData(newClassData);
      setOriginalData(newClassData);
      setIsActivelyEditing(false); // Reset active editing flag
      setShowSuccess(false);
      console.log('✅ Started creating new class:', newClassData);
    }
  };





  // Calculate how many rows a class should span
  const calculateRowSpan = (startTime, endTime) => {
    console.log(`🔍 Calculating rowspan for ${startTime}-${endTime}`);
    
    // For Geo Lab (17:00-19:50), we need to find:
    // - Start slot: "17:00-17:50" (index 9)
    // - End slot: "19:00-19:50" (index 11)
    
    // Find the start and end time slots in our merged time slots array
    const startSlot = timeSlots.find(slot => slot.startsWith(startTime));
    const endSlot = timeSlots.find(slot => slot.endsWith(endTime));
    
    console.log(`🔍 Found slots: startSlot="${startSlot}", endSlot="${endSlot}"`);
    
    if (!startSlot || !endSlot) {
      console.log(`❌ Missing slots, returning 1`);
      return 1;
    }
    
    const startIndex = timeSlots.indexOf(startSlot);
    const endIndex = timeSlots.indexOf(endSlot);
    
    console.log(`🔍 Indices: startIndex=${startIndex}, endIndex=${endIndex}`);
    
    if (startIndex === -1 || endIndex === -1) {
      console.log(`❌ Invalid indices, returning 1`);
      return 1;
    }
    
    // Calculate the number of time slots this class spans
    const span = endIndex - startIndex + 1;
    console.log(`✅ Calculated span: ${span} rows`);
    return Math.max(1, span);
  };

  // Check for time conflicts
  const checkTimeConflict = (startTime, endTime, day, excludeClassId) => {
    if (!timetableData?.timetable?.classes) return false;
    
    const conflict = timetableData.timetable.classes.some(cls => {
      // Skip the class being edited
      if (cls._id === excludeClassId) return false;
      
      // Check if it's the same day
      if (cls.day !== day) return false;
      
      // Check for time overlap
      const existingStart = cls.timeSlot.startTime;
      const existingEnd = cls.timeSlot.endTime;
      
      // Check if the new time slot overlaps with existing ones
      const hasConflict = (
        (startTime >= existingStart && startTime < existingEnd) ||
        (endTime > existingStart && endTime <= existingEnd) ||
        (startTime <= existingStart && endTime >= existingEnd)
      );
      
      if (hasConflict) {
        console.log(`🚨 Frontend conflict detected: ${startTime}-${endTime} conflicts with ${existingStart}-${existingEnd} (${cls.subject})`);
      }
      
      return hasConflict;
    });
    
    return conflict;
  };

  // Auto-save function
  const autoSave = useCallback(async ({ force = false } = {}) => {
    const currentData = editingDataRef.current;
    
    if (!editingCell || !currentData.subject || (isTyping && !force)) {
      return; // Don't auto-save while user is typing
    }

    // Note: Backend will handle time conflict detection
    // Frontend check removed to avoid false positives

    // Check if data has actually changed unless forced
    if (!force) {
      const hasChanged = JSON.stringify(currentData) !== JSON.stringify(originalData);
      if (!hasChanged) {
        return;
      }
    }

    setIsSaving(true);
    const classData = {
      subject: currentData.subject,
      subjectCode: currentData.subjectCode || '',
      teacher: currentData.teacher || '',
      room: currentData.room || '',
      type: currentData.type,
      timeSlot: {
        startTime: currentData.startTime,
        endTime: currentData.endTime
      },
      day: editingCell.day,
      color: currentData.color
    };

    try {
      if (currentData.classId) {
        // Update existing class (both custom and base classes)
        await updateClassMutation.mutateAsync({
          classId: currentData.classId,
          updates: classData
        });
        // Don't reset editing state immediately, let the user continue editing
        setOriginalData({ ...currentData });
        setIsSaving(false);
      } else {
        // Create new class only when there's no existing class
        await addClassMutation.mutateAsync(classData);
        // Don't reset editing state immediately, let the user continue editing
        setOriginalData({ ...currentData });
        setIsSaving(false);
      }
      
      // Show success indicator briefly
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setIsSaving(false);
    }
  }, [editingCell, originalData, updateClassMutation, addClassMutation, isTyping]);

  // Handle manual save
  const handleSave = async () => {
    if (!editingData.subject || !editingData.subject.trim()) {
      toast.error('Please enter a subject name');
      return;
    }
    // Cancel any pending debounce and force a save even if unchanged
    if (window.autoSaveTimeout) clearTimeout(window.autoSaveTimeout);
    setIsTyping(false);
    await autoSave({ force: true });
  };

  // Handle delete
  const handleDelete = () => {
    if (editingData.classId && editingData.isCustom && !editingData.isBaseClass) {
      if (window.confirm('Are you sure you want to delete this custom class?')) {
        deleteClassMutation.mutate(editingData.classId);
      }
    } else {
      toast.error('Cannot delete base timetable classes. You can only delete custom classes you created.');
    }
  };

  // Cancel editing
  const handleCancel = () => {
    console.log('❌ Cancelling edit');
    setEditingCell(null);
    setEditingData({});
    editingDataRef.current = {};
    setOriginalData({});
    setIsSaving(false);
    setIsTyping(false);
    setIsActivelyEditing(false);
    setShowSuccess(false);
    // Clear any pending auto-save
    if (window.autoSaveTimeout) {
      clearTimeout(window.autoSaveTimeout);
    }
  };

  // Handle field change with auto-save
  const handleFieldChange = (field, value) => {
    console.log(`📝 Field changed: ${field} = "${value}"`);
    const newData = { ...editingData, [field]: value };
    if (field === 'startTime') {
      // If endTime is not set or now invalid, set it to the next available slot
      const nextEnd = endTimes.find((t) => t > value) || endTimes[endTimes.length - 1];
      if (!newData.endTime || newData.endTime <= value) {
        newData.endTime = nextEnd;
      }
    }
    if (field === 'color' && editingData.classId) {
      // If updating a saved class, update list immediately so UI reflects new color
      if (timetableData?.timetable?.classes) {
        const classes = timetableData.timetable.classes.map((c) =>
          c._id === editingData.classId ? { ...c, color: value } : c
        );
        // Optimistically update cache
        queryClient.setQueryData('userTimetable', (old) => ({
          ...(old || {}),
          timetable: { ...(old?.timetable || {}), classes }
        }));
      }
    }
    
    // Mark as actively editing when user makes changes
    setIsActivelyEditing(true);
    setEditingData(newData);
    editingDataRef.current = newData; // Keep a stable reference
    setIsTyping(true);
    
    // If you prefer no auto-save, comment this block back in.
    // We now disable idle auto-save; user must click Save explicitly.
    if (window.autoSaveTimeout) {
      clearTimeout(window.autoSaveTimeout);
    }
  };

  // Fast path for color picking: apply instantly, optimistically update list, and save immediately
  const handleColorPick = (color, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const newData = { ...editingData, color };
    setIsActivelyEditing(true);
    setEditingData(newData);
    editingDataRef.current = newData;

    // Optimistic update for visible class card
    if (editingData.classId && timetableData?.timetable?.classes) {
      const classes = timetableData.timetable.classes.map((c) =>
        c._id === editingData.classId ? { ...c, color } : c
      );
      queryClient.setQueryData('userTimetable', (old) => ({
        ...(old || {}),
        timetable: { ...(old?.timetable || {}), classes }
      }));
    }
    // Do NOT auto-save on color pick; user will click Save explicitly
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (editingCell) {
        if (e.key === 'Escape') {
          handleCancel();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          handleSave();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingCell, editingData]);

  // Cleanup auto-save timeout
  useEffect(() => {
    return () => {
      if (window.autoSaveTimeout) {
        clearTimeout(window.autoSaveTimeout);
      }
    };
  }, []);

  // Show loading if not authenticated
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Editable Timetable</h1>
          <p className="text-gray-600">
            {timetableData?.timetable?.branch} - Year {timetableData?.timetable?.year}
          </p>
          <div className="mt-2">
            <button
              onClick={() => window.location.href = '/timetable'}
              className="text-sm text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
            >
              <BookOpen className="w-3 h-3" />
              Switch to Regular View
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button
            onClick={() => window.location.href = '/timetable'}
            className="btn btn-secondary flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            View Timetable
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className="btn btn-accent flex items-center gap-2"
          >
            <Grid className="w-4 h-4" />
            {showGrid ? 'Hide Grid' : 'Show Grid'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
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

      {/* Editable Grid */}
      {showGrid && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: '140px' }} />
                {days.map((_, i) => (
                  <col key={i} style={{ width: `calc((100% - 140px)/${days.length})` }} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis">
                    Time
                  </th>
                  {days.map((day) => (
                    <th key={day} className="border border-gray-200 px-3 py-3 text-center font-semibold text-gray-700">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((timeSlot, index) => (
                  <tr key={timeSlot} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 align-top whitespace-nowrap overflow-hidden text-ellipsis">
                      {timeSlot}
                    </td>
                    {days.map((day) => {
                      const classData = getClassAtTime(timeSlot, day);
                      const isEditing = editingCell?.time === timeSlot && editingCell?.day === day;
                      
                      // Check if this class should span multiple rows
                      const shouldSpanRows = classData && classData.timeSlot.startTime === timeSlot.split('-')[0];
                      const rowSpan = shouldSpanRows ? calculateRowSpan(classData.timeSlot.startTime, classData.timeSlot.endTime) : 1;
                      
                      // Debug logging
                      if (classData) {
                        console.log(`🔍 Cell ${timeSlot} on ${day}: Class "${classData.subject}" (${classData.timeSlot.startTime}-${classData.timeSlot.endTime}), shouldSpan: ${shouldSpanRows}, rowSpan: ${rowSpan}`);
                      }
                      
                      // Skip rendering if this cell is spanned by a class from above
                      if (!shouldSpanRows && classData && classData.timeSlot.startTime !== timeSlot.split('-')[0]) {
                        console.log(`🚫 Skipping cell ${timeSlot} on ${day} - spanned by class above`);
                        return null;
                      }
                      
                      // Additional debugging for Geo class
                      if (classData && classData.subject === 'Geo') {
                        console.log(`🔍 Geo class rendering: timeSlot=${timeSlot}, shouldSpan=${shouldSpanRows}, rowSpan=${rowSpan}, willSkip=${!shouldSpanRows && classData && classData.timeSlot.startTime !== timeSlot.split('-')[0]}`);
                      }
                      
                      return (
                        <td 
                          key={`${day}-${timeSlot}`} 
                          className="border border-gray-200 px-2 py-2 cursor-pointer hover:bg-blue-50 transition-colors align-top"
                          style={{ 
                            height: rowSpan > 1 ? `${rowSpan * 60}px` : '60px'
                          }}
                          onClick={() => handleCellClick(timeSlot, day)}
                          rowSpan={rowSpan}
                        >
                          {isEditing ? (
                            <div className="relative">
                              <div className="absolute top-0 left-0 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 min-w-[320px] max-w-[400px] max-h-[500px] overflow-y-auto"
                                   style={{
                                     transform: 'translate(-50%, -10px)',
                                     left: '50%'
                                   }}>
                                                                                              <div className="text-xs text-gray-600 mb-2 bg-blue-50 p-2 rounded border border-blue-200">
                                   <div className="flex items-center gap-2">
                                     <Edit className="w-3 h-3 text-blue-600" />
                                     <span className="font-medium">Editing: {editingCell.time} on {editingCell.day}</span>
                                   {editingData.isBaseClass && (
                                     <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                       Base Class
                                     </span>
                                   )}
                                   {editingData.isCustom && !editingData.isBaseClass && (
                                     <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                       Custom Class
                                     </span>
                                   )}
                                   <div className="ml-auto flex items-center gap-2">
                                     {isTyping && (
                                       <span className="flex items-center gap-1 text-orange-600">
                                         <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
                                         Typing...
                                       </span>
                                     )}
                                     {isSaving && (
                                       <span className="flex items-center gap-1 text-blue-600">
                                         <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                         Saving...
                                       </span>
                                     )}
                                     {showSuccess && (
                                       <span className="flex items-center gap-1 text-green-600">
                                         <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                                         Saved!
                                       </span>
                                     )}
                                   </div>
                                 </div>
                                 {editingData.isBaseClass && (
                                   <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                                     💡 <strong>Base Class:</strong> This is an original timetable class. Your changes will create a custom copy.
                                   </div>
                                 )}
                               </div>
                               
                               {/* Debug Panel removed for production */}
                               
                              <input
                                id="edit-subject"
                                name="subject"
                                type="text"
                                placeholder="Subject"
                                value={editingData.subject || ''}
                                onChange={(e) => handleFieldChange('subject', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoComplete="off"
                              />
                              <input
                                id="edit-subjectCode"
                                name="subjectCode"
                                type="text"
                                placeholder="Subject Code"
                                value={editingData.subjectCode || ''}
                                onChange={(e) => handleFieldChange('subjectCode', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoComplete="off"
                              />
                              <input
                                id="edit-teacher"
                                name="teacher"
                                type="text"
                                placeholder="Teacher"
                                value={editingData.teacher || ''}
                                onChange={(e) => handleFieldChange('teacher', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoComplete="off"
                              />
                              <input
                                id="edit-room"
                                name="room"
                                type="text"
                                placeholder="Room"
                                value={editingData.room || ''}
                                onChange={(e) => handleFieldChange('room', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoComplete="off"
                              />
                              <select
                                value={editingData.type}
                                onChange={(e) => handleFieldChange('type', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="Lecture">Lecture</option>
                                <option value="Lab">Lab</option>
                                <option value="Tutorial">Tutorial</option>
                                <option value="Seminar">Seminar</option>
                                <option value="Project">Project</option>
                              </select>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={editingData.startTime}
                                  onChange={(e) => handleFieldChange('startTime', e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {startTimes.map((time) => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                                <select
                                  value={editingData.endTime}
                                  onChange={(e) => handleFieldChange('endTime', e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {endTimes
                                    .filter((time) => !editingData.startTime || time > editingData.startTime)
                                    .map((time) => (
                                      <option key={time} value={time}>{time}</option>
                                    ))}
                                </select>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">Color:</span>
                                <div className="flex gap-1">
                                  {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={(e) => handleColorPick(color, e)}
                                      className={`w-4 h-4 rounded border-2 ${
                                        editingData.color === color ? 'border-gray-800' : 'border-gray-300'
                                      }`}
                                      style={{ backgroundColor: color }}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={handleSave}
                                  disabled={isSaving}
                                  className={`flex-1 px-2 py-1 text-xs rounded flex items-center justify-center gap-1 ${
                                    isSaving 
                                      ? 'bg-gray-400 cursor-not-allowed' 
                                      : 'bg-green-600 hover:bg-green-700'
                                  } text-white`}
                                >
                                  {isSaving ? (
                                    <>
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="w-3 h-3" />
                                      Save
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={handleCancel}
                                  className="flex-1 px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                {editingData.classId && editingData.isCustom && !editingData.isBaseClass && (
                                  <button
                                    onClick={handleDelete}
                                    className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              </div>
                            </div>
                          ) : classData ? (
                            <div 
                              className="p-2 rounded text-xs cursor-pointer hover:bg-blue-100 transition-colors"
                              style={{ 
                                backgroundColor: classData.color + '20', 
                                borderLeft: `3px solid ${classData.color}`,
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                              }}
                            >
                              <div>
                                <div className="font-medium text-gray-900">{classData.subject}</div>
                                <div className="text-gray-600">{classData.subjectCode}</div>
                                <div className="text-gray-500">{classData.teacher}</div>
                                <div className="text-gray-500">{classData.room}</div>
                                <div className="text-gray-500 capitalize">{classData.type}</div>
                              </div>
                              
                              <div className="mt-auto">
                                <div className="text-xs text-gray-600 mt-1">
                                  {classData.timeSlot.startTime} - {classData.timeSlot.endTime}
                                </div>
                                {classData.isCustom && (
                                  <div className="mt-1">
                                    <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      Custom
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-xs text-center py-2">
                              Click to add class
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

             {/* Instructions */}
       <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
         <h3 className="font-semibold text-blue-900 mb-2">How to Edit:</h3>
         <ul className="text-sm text-blue-800 space-y-1">
           <li>• Click on any cell to add or edit a class</li>
           <li>• Fill in the required fields (Subject, Teacher, Room)</li>
           <li>• Choose the class type (Lecture, Lab, Tutorial, etc.)</li>
           <li>• Select start and end times from the dropdowns (50-minute slots)</li>
           <li>• Pick a color for your class</li>
           <li>• <strong>Time Slots:</strong> Each slot represents a 50-minute period (e.g., 08:00-08:50)</li>
           <li>• <strong>Multi-slot Classes:</strong> Labs and longer classes automatically span multiple time slots</li>
           <li>• <strong>Base Classes:</strong> Yellow badge shows original timetable classes</li>
           <li>• <strong>Custom Classes:</strong> Green badge shows classes you created</li>
           <li>• <strong>Auto-save:</strong> Changes are automatically saved after 2 seconds of inactivity</li>
           <li>• <strong>Visual indicators:</strong> Orange dot = typing, Blue spinner = saving</li>
           <li>• Click Save to manually save or X to cancel</li>
           <li>• Only custom classes can be deleted (red button)</li>
           <li>• <strong>Keyboard shortcuts:</strong> Esc to cancel, Ctrl+Enter to save</li>
         </ul>
       </div>

      {/* Add/Edit Class Modal */}
      {showAddModal && (
        <AddEditClassModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={async (formData) => {
            try {
              console.log('📝 Submitting new class:', formData);
              await addClassMutation.mutateAsync(formData);
              setShowAddModal(false);
              toast.success('Class added successfully!');
            } catch (error) {
              console.error('Failed to add class:', error);
              toast.error('Failed to add class. Please try again.');
            }
          }}
          editingClass={null}
          selectedDay="Monday"
        />
      )}
    </div>
  );
};

export default EditableTimetable;
