import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Palette, Eye, EyeOff, Settings } from 'lucide-react';
import { useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

const TimetablePreferences = ({ isOpen, onClose, preferences }) => {
  const [localPreferences, setLocalPreferences] = useState({
    showCustomClasses: preferences?.showCustomClasses ?? true,
    showHiddenClasses: preferences?.showHiddenClasses ?? false,
    defaultColor: preferences?.defaultColor ?? '#3B82F6'
  });

  const queryClient = useQueryClient();

  const updatePreferencesMutation = useMutation(
    async (newPreferences) => {
      const response = await api.put('/api/user-timetable/preferences', newPreferences);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('userTimetable');
        toast.success('Preferences updated successfully!');
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update preferences');
      }
    }
  );

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
    '#84CC16', '#F97316', '#EC4899', '#6366F1', '#14B8A6', '#F43F5E'
  ];

  const handleSave = () => {
    updatePreferencesMutation.mutate(localPreferences);
  };

  const handleCancel = () => {
    setLocalPreferences({
      showCustomClasses: preferences?.showCustomClasses ?? true,
      showHiddenClasses: preferences?.showHiddenClasses ?? false,
      defaultColor: preferences?.defaultColor ?? '#3B82F6'
    });
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
          onClick={handleCancel}
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
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Timetable Preferences
            </h2>
            <button
              onClick={handleCancel}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Display Options */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Display Options</h3>
              
              {/* Show Custom Classes */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-green-600" />
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Show Custom Classes
                    </label>
                    <p className="text-xs text-gray-500">
                      Display classes you've added to your timetable
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localPreferences.showCustomClasses}
                    onChange={(e) => setLocalPreferences(prev => ({
                      ...prev,
                      showCustomClasses: e.target.checked
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Show Hidden Classes */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <EyeOff className="w-5 h-5 text-orange-600" />
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Show Hidden Classes
                    </label>
                    <p className="text-xs text-gray-500">
                      Display classes you've hidden from the base timetable
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localPreferences.showHiddenClasses}
                    onChange={(e) => setLocalPreferences(prev => ({
                      ...prev,
                      showHiddenClasses: e.target.checked
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            {/* Default Color */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                Default Color
              </h3>
              <p className="text-sm text-gray-600">
                Choose the default color for new custom classes
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setLocalPreferences(prev => ({
                      ...prev,
                      defaultColor: color
                    }))}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      localPreferences.defaultColor === color 
                        ? 'border-gray-800 scale-110' 
                        : 'border-gray-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Current Selection Preview */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
              <div className="flex items-center gap-3">
                <div 
                  className="w-6 h-6 rounded border border-gray-300"
                  style={{ backgroundColor: localPreferences.defaultColor }}
                />
                <span className="text-sm text-gray-600">
                  New custom classes will use this color
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-gray-200">
            <button
              onClick={handleCancel}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updatePreferencesMutation.isLoading}
              className="btn btn-primary flex-1"
            >
              {updatePreferencesMutation.isLoading ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TimetablePreferences; 