import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Calendar, 
  Clock, 
  BookOpen, 
  AlertCircle,
  CheckCircle,
  
  Filter,
  LogOut,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import GoogleClassroomIntegration from './GoogleClassroomIntegration';

const Assignments = () => {
  const [filter, setFilter] = useState('all');
  // Assignments currently shown in the UI. When Google Classroom sync completes,
  // we map the synced items into this shape and display them.
  const [displayAssignments, setDisplayAssignments] = useState(() => {
    try {
      const raw = localStorage.getItem('gc_display_assignments');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed;
    } catch (_) {
      return null;
    }
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  // Fetch assignments
  const { data: assignmentsData, isLoading } = useQuery(
    'assignments',
    async () => {
      const response = await api.get('/api/assignments');
      return response.data;
    },
    {
      // Do not auto-expire; we manage persistence via localStorage
      staleTime: Infinity,
      cacheTime: Infinity,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false
    }
  );

  // Mock data for now since assignments routes are basic
  const mockAssignments = [
    {
      _id: '1',
      title: 'Data Structures Lab Assignment',
      subject: 'Computer Science',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Implement binary search tree operations',
      priority: 'High',
      status: 'Pending',
      estimatedHours: 4
    },
    {
      _id: '2',
      title: 'Machine Learning Quiz',
      subject: 'Computer Science',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Quiz on supervised learning algorithms',
      priority: 'Medium',
      status: 'In Progress',
      estimatedHours: 2
    },
    {
      _id: '3',
      title: 'Engineering Drawing Project',
      subject: 'Mechanical',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Create technical drawings for machine parts',
      priority: 'Low',
      status: 'Pending',
      estimatedHours: 8
    }
  ];

  const baseAssignments = assignmentsData?.assignments || mockAssignments;
  const assignments = (displayAssignments && Array.isArray(displayAssignments) && displayAssignments.length)
    ? displayAssignments
    : baseAssignments;

  const filteredAssignments = assignments.filter(assignment => {
    if (filter === 'all') return true;
    if (filter === 'pending') return assignment.status === 'Pending';
    if (filter === 'progress') return assignment.status === 'In Progress';
    if (filter === 'completed') return assignment.status === 'Completed';
    return true;
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'text-red-600 bg-red-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'Low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'In Progress': return <Clock className="w-5 h-5 text-yellow-600" />;
      default: return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  };

  if (isLoading && !displayAssignments) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Assignments</h1>
          <p className="text-gray-600">Manage your assignments and deadlines</p>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Assignment
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'all', label: 'All', count: assignments.length },
          { key: 'pending', label: 'Pending', count: assignments.filter(a => a.status === 'Pending').length },
          { key: 'progress', label: 'In Progress', count: assignments.filter(a => a.status === 'In Progress').length },
          { key: 'completed', label: 'Completed', count: assignments.filter(a => a.status === 'Completed').length }
        ].map(filterOption => (
          <button
            key={filterOption.key}
            onClick={() => setFilter(filterOption.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              filter === filterOption.key
                ? 'bg-primary text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            {filterOption.label}
            <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs">
              {filterOption.count}
            </span>
          </button>
        ))}
      </div>

      {/* Google Classroom Integration */}
      <div className="mb-8">
        <GoogleClassroomIntegration onAssignmentsUpdate={(googleAssignments) => {
          // Map Google assignments to the UI's expected shape
          const mapped = (googleAssignments || []).map((a) => ({
            _id: a.id,
            title: a.title || 'Untitled',
            subject: a.course?.name || 'Google Classroom',
            dueDate: a.dueDate || null,
            description: a.description || '',
            link: a.alternateLink || null,
            priority: 'Medium',
            status: a.submission?.state === 'TURNED_IN' ? 'Completed' : 'Pending',
            estimatedHours: 1
          }));
          setDisplayAssignments(mapped);
          try { localStorage.setItem('gc_display_assignments', JSON.stringify(mapped)); } catch (_) {}
        }} />
      </div>

      {/* Assignments Grid */}
      {filteredAssignments.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No assignments found</h3>
          <p className="text-gray-500">
            {filter === 'all' 
              ? 'Add your first assignment to get started!' 
              : `No assignments with status "${filter}"`
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssignments.map((assignment) => (
            <motion.div
              key={assignment._id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`bg-white rounded-xl shadow-lg p-6 border-l-4 border-primary hover:shadow-xl transition-shadow ${assignment.link ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (assignment.link) {
                  window.open(assignment.link, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {assignment.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{assignment.subject}</p>
                </div>
                {assignment.link && (
                  <div className="flex gap-2">
                    <a
                      href={assignment.link}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 text-blue-700 hover:bg-blue-100 rounded flex items-center gap-1 text-sm"
                      title="Open in Google Classroom"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open
                    </a>
                  </div>
                )}
              </div>

              <p className="text-gray-700 mb-4 text-sm line-clamp-2">
                {assignment.description}
              </p>

              <div className="space-y-3">
                {/* Due Date */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {formatDate(assignment.dueDate)}
                  </span>
                </div>

                {/* Estimated Hours */}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {assignment.estimatedHours} hours estimated
                  </span>
                </div>

                {/* Status and Priority */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(assignment.status)}
                    <span className="text-sm font-medium text-gray-700">
                      {assignment.status}
                    </span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(assignment.priority)}`}>
                    {assignment.priority}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Assignment Modal - Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold mb-4">Add Assignment</h2>
            <p className="text-gray-600 mb-4">Assignment creation modal coming soon!</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  toast.success('Feature coming soon!');
                }}
                className="btn btn-primary flex-1"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assignments;