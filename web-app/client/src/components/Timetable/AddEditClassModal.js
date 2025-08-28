import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, User } from 'lucide-react';

const AddEditClassModal = React.memo(({ isOpen, onClose, onSubmit, editingClass, selectedDay }) => {
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [formData, setFormData] = useState({
    subject: '',
    subjectCode: '',
    teacher: '',
    room: '',
    type: 'Lecture',
    day: 'Monday',
    weekType: 'All',
    startTime: '',
    endTime: ''
  });
  
  const [errors, setErrors] = useState({});
  const [userHasInteracted, setUserHasInteracted] = useState(false);

  const colors = useMemo(() => [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
    '#84CC16', '#F97316', '#EC4899', '#6366F1', '#14B8A6', '#F43F5E'
  ], []);

  const classTypes = useMemo(() => ['Lecture', 'Tutorial', 'Lab', 'Seminar', 'Project'], []);
  const weekTypes = useMemo(() => ['All', 'Odd', 'Even'], []);

  // Track if form has been initialized to prevent overwriting user input
  const [isFormInitialized, setIsFormInitialized] = useState(false);

  // Initialize form when modal opens - but only if user hasn't interacted!
  useEffect(() => {
    if (!isOpen) {
      setIsFormInitialized(false);
      setUserHasInteracted(false);
      return;
    }
    
    // Don't override form data if user has already started typing
    if (userHasInteracted) {
      console.log('🚫 User has interacted with form, preserving data...');
      return;
    }
    
    // Only initialize if not already initialized
    if (isFormInitialized) {
      console.log('🚫 Form already initialized, skipping...');
      return;
    }
    
    console.log('🚀 Modal opened, initializing form...', { editingClass, selectedDay });
    
    if (editingClass) {
      // Editing existing class - populate all fields
      const newFormData = {
        subject: editingClass.subject || '',
        subjectCode: editingClass.subjectCode || '',
        teacher: editingClass.teacher || '',
        room: editingClass.room || '',
        type: editingClass.type || 'Lecture',
        day: editingClass.day || 'Monday',
        weekType: editingClass.weekType || 'All',
        startTime: editingClass.timeSlot?.startTime || '',
        endTime: editingClass.timeSlot?.endTime || ''
      };
      
      console.log('✏️ Setting edit form data:', newFormData);
      setFormData(newFormData);
      setSelectedColor(editingClass.color || '#3B82F6');
    } else {
      // Adding new class - set defaults
      const newFormData = {
        subject: '',
        subjectCode: '',
        teacher: '',
        room: '',
        type: 'Lecture',
        day: selectedDay || 'Monday',
        weekType: 'All',
        startTime: '09:00',
        endTime: '09:50'
      };
      
      console.log('➕ Setting new form data:', newFormData);
      setFormData(newFormData);
      setSelectedColor('#3B82F6');
    }
    
    setIsFormInitialized(true);
  }, [isOpen, editingClass, selectedDay, isFormInitialized, userHasInteracted]);

  // Handle input changes
  const handleInputChange = useCallback((field, value) => {
    console.log(`🔄 Field changed: ${field} = "${value}"`);
    
    // Mark that user has interacted with the form
    setUserHasInteracted(true);
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      console.log('📝 Updated formData:', newData);
      return newData;
    });
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  }, [errors]);

  // Validate form data
  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject name is required';
    }
    
    if (!formData.day) {
      newErrors.day = 'Day is required';
    }
    
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }
    
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }
    
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const classData = {
      ...formData,
      color: selectedColor,
      timeSlot: {
        startTime: formData.startTime,
        endTime: formData.endTime
      }
    };
    
    onSubmit(classData);
    
    // Reset form data
    if (!editingClass) {
      setFormData({
        subject: '',
        subjectCode: '',
        teacher: '',
        room: '',
        type: 'Lecture',
        day: selectedDay || 'Monday',
        weekType: 'All',
        startTime: '09:00',
        endTime: '09:50'
      });
      setErrors({});
    }
  };

  const handleClose = () => {
    setFormData({
      subject: '',
      subjectCode: '',
      teacher: '',
      room: '',
      type: 'Lecture',
      day: 'Monday',
      weekType: 'All',
      startTime: '09:00',
      endTime: '09:50'
    });
    setErrors({});
    setIsFormInitialized(false);
    setUserHasInteracted(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black bg-opacity-50"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
          style={{ maxWidth: 'min(28rem, calc(100vw - 2rem))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingClass ? 'Edit Class' : 'Add Custom Class'}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Debug Info removed for production */}

          {/* Form */}
          <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
            {/* Subject */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                Subject Name *
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                className="input w-full"
                placeholder="e.g., Advanced Mathematics"
                autoComplete="off"
              />
              {errors.subject && (
                <p className="text-red-500 text-sm mt-1">{errors.subject}</p>
              )}
            </div>

            {/* Subject Code */}
            <div>
              <label htmlFor="subjectCode" className="block text-sm font-medium text-gray-700 mb-2">
                Subject Code
              </label>
              <input
                id="subjectCode"
                name="subjectCode"
                type="text"
                value={formData.subjectCode}
                onChange={(e) => handleInputChange('subjectCode', e.target.value)}
                className="input w-full"
                placeholder="e.g., MATH301"
                autoComplete="off"
              />
            </div>

            {/* Teacher */}
            <div>
              <label htmlFor="teacher" className="block text-sm font-medium text-gray-700 mb-2">
                Teacher
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="teacher"
                  name="teacher"
                  type="text"
                  value={formData.teacher}
                  onChange={(e) => handleInputChange('teacher', e.target.value)}
                  className="input w-full pl-10"
                  placeholder="e.g., Dr. Smith"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Room */}
            <div>
              <label htmlFor="room" className="block text-sm font-medium text-gray-700 mb-2">
                Room
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="room"
                  name="room"
                  type="text"
                  value={formData.room}
                  onChange={(e) => handleInputChange('room', e.target.value)}
                  className="input w-full pl-10"
                  placeholder="e.g., Room 101"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Class Type and Week Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                  Class Type
                </label>
                <select 
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="input w-full"
                >
                  {classTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="weekType" className="block text-sm font-medium text-gray-700 mb-2">
                  Week Type
                </label>
                <select 
                  id="weekType"
                  name="weekType"
                  value={formData.weekType}
                  onChange={(e) => handleInputChange('weekType', e.target.value)}
                  className="input w-full"
                >
                  {weekTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Day */}
            <div>
              <label htmlFor="day" className="block text-sm font-medium text-gray-700 mb-2">
                Day *
              </label>
              <select 
                id="day"
                name="day"
                value={formData.day}
                onChange={(e) => handleInputChange('day', e.target.value)}
                className="input w-full"
              >
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
              </select>
              {errors.day && (
                <p className="text-red-500 text-sm mt-1">{errors.day}</p>
              )}
            </div>

            {/* Time Slot */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Slot *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startTime" className="block text-xs text-gray-600 mb-1">Start Time</label>
                  <select
                    id="startTime"
                    name="startTime"
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Select start time</option>
                    <option value="08:00">08:00</option>
                    <option value="09:00">09:00</option>
                    <option value="10:00">10:00</option>
                    <option value="11:00">11:00</option>
                    <option value="12:00">12:00</option>
                    <option value="13:00">13:00</option>
                    <option value="14:00">14:00</option>
                    <option value="15:00">15:00</option>
                    <option value="16:00">16:00</option>
                    <option value="17:00">17:00</option>
                    <option value="18:00">18:00</option>
                    <option value="19:00">19:00</option>
                  </select>
                  {errors.startTime && (
                    <p className="text-red-500 text-sm mt-1">{errors.startTime}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="endTime" className="block text-xs text-gray-600 mb-1">End Time</label>
                  <select
                    id="endTime"
                    name="endTime"
                    value={formData.endTime}
                    onChange={(e) => handleInputChange('endTime', e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Select end time</option>
                    <option value="08:50">08:50</option>
                    <option value="09:50">09:50</option>
                    <option value="10:50">10:50</option>
                    <option value="11:50">11:50</option>
                    <option value="12:50">12:50</option>
                    <option value="13:50">13:50</option>
                    <option value="14:50">14:50</option>
                    <option value="15:50">15:50</option>
                    <option value="16:50">16:50</option>
                    <option value="17:50">17:50</option>
                    <option value="18:50">18:50</option>
                    <option value="19:50">19:50</option>
                  </select>
                  {errors.endTime && (
                    <p className="text-red-500 text-sm mt-1">{errors.endTime}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {colors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      selectedColor === color 
                        ? 'border-gray-800 scale-110' 
                        : 'border-gray-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
              >
                {editingClass ? 'Update Class' : 'Add Class'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

export default AddEditClassModal; 