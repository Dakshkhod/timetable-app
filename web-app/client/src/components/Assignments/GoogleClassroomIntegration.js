import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  RefreshCw, 
  Link, 
  Unlink, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Calendar,
  FileText,
  ExternalLink,
  Settings,
  ChevronDown,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const GoogleClassroomIntegration = ({ onAssignmentsUpdate }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  // Initialize from localStorage immediately so selection persists across refresh/navigation
  const [selectedCourseIds, setSelectedCourseIds] = useState(() => {
    try {
      const raw = localStorage.getItem('gc_selected_courses');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  });
  const [showCourseSelector, setShowCourseSelector] = useState(() => {
    try {
      const raw = localStorage.getItem('gc_selected_courses');
      const parsed = raw ? JSON.parse(raw) : [];
      return !(Array.isArray(parsed) && parsed.length > 0);
    } catch (_) {
      return true;
    }
  });
  const [isFetchingCourses, setIsFetchingCourses] = useState(false);
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const collapsed = localStorage.getItem('gc_collapsed');
    if (collapsed === '1') return true;
    try {
      const raw = localStorage.getItem('gc_selected_courses');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) && parsed.length > 0; // default collapsed if user has already selected
    } catch (_) {
      return false;
    }
  });
  const { isAuthenticated } = useAuth();

  // Get Google Classroom connection status
  const { data: googleStatus, isLoading: statusLoading } = useQuery(
    'googleStatus',
    async () => {
      const response = await api.get('/api/google/status');
      return response.data;
    },
    {
      enabled: isAuthenticated, // Only run query if user is authenticated
      refetchInterval: 30000, // Refresh every 30 seconds
      staleTime: 10000
    }
  );

  // Load persisted preferences from server
  const { data: prefs } = useQuery(
    'googlePreferences',
    async () => {
      const response = await api.get('/api/google/preferences');
      return response.data;
    },
    { enabled: isAuthenticated }
  );

  useEffect(() => {
    if (!prefs) return;
    if (Array.isArray(prefs.selectedCourseIds) && prefs.selectedCourseIds.length) {
      setSelectedCourseIds(prefs.selectedCourseIds);
      try { localStorage.setItem('gc_selected_courses', JSON.stringify(prefs.selectedCourseIds)); } catch (_) {}
    }
    if (typeof prefs.collapsed === 'boolean') {
      setIsCollapsed(prefs.collapsed);
      localStorage.setItem('gc_collapsed', prefs.collapsed ? '1' : '0');
    }
  }, [prefs]);

  // Get Google Classroom courses
  const { data: courses, isLoading: coursesLoading, refetch: refetchCourses, isError: coursesError } = useQuery(
    'googleCourses',
    async () => {
      if (!googleStatus?.status?.isConnected) return [];
      const response = await api.get('/api/google/courses');
      return response.data.courses;
    },
    {
      enabled: isAuthenticated && googleStatus?.status?.isConnected,
      // Never auto-expire; rely on user-initiated sync
      staleTime: Infinity,
      cacheTime: Infinity,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: 1
    }
  );

  // When courses list changes, reconcile against stored selections but keep previous choices if course ids still valid
  useEffect(() => {
    if (!courses) return;
    try {
      const raw = localStorage.getItem('gc_selected_courses');
      const parsed = raw ? JSON.parse(raw) : selectedCourseIds;
      const valid = (parsed || []).filter((id) => courses.some((c) => c.id === id));
      setSelectedCourseIds(valid);
    } catch (_) {
      // ignore
    }
  }, [courses]);

  const toggleCourse = (courseId) => {
    setSelectedCourseIds((prev) => {
      const next = prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId];
      localStorage.setItem('gc_selected_courses', JSON.stringify(next));
      // Persist to server
      api.post('/api/google/preferences', { selectedCourseIds: next }).catch(() => {});
      // Invalidate AI context queries to ensure fresh data
      queryClient.invalidateQueries('classroomAssignments');
      return next;
    });
  };

  const selectAllCourses = () => {
    const all = (courses || []).map((c) => c.id);
    setSelectedCourseIds(all);
    localStorage.setItem('gc_selected_courses', JSON.stringify(all));
    api.post('/api/google/preferences', { selectedCourseIds: all }).catch(() => {});
    // Invalidate AI context queries to ensure fresh data
    queryClient.invalidateQueries('classroomAssignments');
  };

  const clearAllCourses = () => {
    setSelectedCourseIds([]);
    localStorage.setItem('gc_selected_courses', JSON.stringify([]));
    api.post('/api/google/preferences', { selectedCourseIds: [] }).catch(() => {});
    // Invalidate AI context queries to ensure fresh data
    queryClient.invalidateQueries('classroomAssignments');
  };

  // Sync assignments mutation
  const syncMutation = useMutation(
    async () => {
      const response = await api.post('/api/google/sync');
      return response.data;
    },
    {
      onSuccess: (data) => {
        toast.success(`Synced ${data.totalAssignments} assignments from Google Classroom!`);
        queryClient.invalidateQueries('assignments');
        if (onAssignmentsUpdate) {
          onAssignmentsUpdate(data.assignments);
        }
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to sync assignments');
      }
    }
  );

  // Sync only selected courses
  const syncSelectedMutation = useMutation(
    async (overrideIds) => {
      const ids = Array.isArray(overrideIds) && overrideIds.length ? overrideIds : selectedCourseIds;
      if (!ids.length) {
        throw new Error('Select at least one course to sync');
      }
      const requests = ids.map((id) =>
        api.get('/api/google/assignments', { params: { courseId: id } })
      );
      const responses = await Promise.all(requests);
      const assignments = responses.flatMap((r) => r.data.assignments || []);
      return { assignments, totalAssignments: assignments.length };
    },
    {
      onSuccess: (data) => {
        toast.success(`Synced ${data.totalAssignments} assignments from selected courses`);
        if (onAssignmentsUpdate) {
          onAssignmentsUpdate(data.assignments);
        }
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to sync selected courses');
      }
    }
  );

  const handleFetchCoursesAndSyncAll = async () => {
    try {
      setIsFetchingCourses(true);
      const { data } = await api.get('/api/google/courses');
      const fetched = data?.courses || [];
      if (!fetched.length) {
        toast.error('No courses found for your account');
        return;
      }
      const ids = fetched.map((c) => c.id);
      setSelectedCourseIds(ids);
      localStorage.setItem('gc_selected_courses', JSON.stringify(ids));
      // Update react-query cache and UI list
      await refetchCourses();
      // Sync everything just fetched
      syncSelectedMutation.mutate(ids, {
        onSuccess: (result) => {
          setIsCollapsed(true);
          localStorage.setItem('gc_collapsed', '1');
          try { localStorage.setItem('gc_display_assignments', JSON.stringify(result.assignments)); } catch (_) {}
                  // Update backend preferences to ensure AI context gets correct course selection
        api.post('/api/google/preferences', { selectedCourseIds: ids, collapsed: true }).catch(() => {});
        // Invalidate AI context queries to ensure fresh data
        queryClient.invalidateQueries('classroomAssignments');
      }
    });
  } catch (error) {
    toast.error(error.response?.data?.message || 'Failed to fetch courses');
  } finally {
    setIsFetchingCourses(false);
  }
};

  // Disconnect Google account mutation
  const disconnectMutation = useMutation(
    async () => {
      const response = await api.post('/api/google/disconnect');
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success('Google Classroom account disconnected successfully');
        queryClient.invalidateQueries('googleStatus');
        queryClient.invalidateQueries('googleCourses');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to disconnect account');
      }
    }
  );

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const response = await api.get('/api/google/auth');
      window.location.href = response.data.authUrl;
    } catch (error) {
      toast.error('Failed to initiate Google Classroom connection');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = () => {
    if (!selectedCourseIds.length) {
      // If user never chose, default to all courses once to behave like Classroom
      const all = (courses || []).map((c) => c.id);
      if (all.length === 0) {
        toast.error('No courses available to sync');
        return;
      }
      setSelectedCourseIds(all);
      localStorage.setItem('gc_selected_courses', JSON.stringify(all));
    }
    const toSync = (selectedCourseIds.length ? selectedCourseIds : (courses || []).map(c => c.id));
    syncSelectedMutation.mutate(toSync, {
      onSuccess: () => {
        setIsCollapsed(true);
        localStorage.setItem('gc_collapsed', '1');
        api.post('/api/google/preferences', { selectedCourseIds, collapsed: true }).catch(() => {});
      }
    });
  };

  const handleResetPreferences = async () => {
    try {
      await api.post('/api/google/preferences', { selectedCourseIds: [], collapsed: false });
    } catch (_) {}
    setSelectedCourseIds([]);
    setIsCollapsed(false);
    setShowCourseSelector(true);
    try {
      localStorage.removeItem('gc_selected_courses');
      localStorage.removeItem('gc_collapsed');
      localStorage.removeItem('gc_display_assignments');
    } catch (_) {}
    if (onAssignmentsUpdate) onAssignmentsUpdate([]);
    toast.success('Classroom preferences reset');
  };

  const handleDisconnect = () => {
    if (window.confirm('Are you sure you want to disconnect your Google Classroom account? This will remove all synced data.')) {
      disconnectMutation.mutate();
    }
  };

  const formatLastSync = (lastSync) => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  };

  if (statusLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  const isConnected = googleStatus?.status?.isConnected;
  const lastSync = googleStatus?.status?.lastSync;

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('gc_collapsed', next ? '1' : '0');
      api.post('/api/google/preferences', { collapsed: next }).catch(() => {});
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Google Classroom</h3>
            <p className="text-sm text-gray-600">Sync assignments and courses automatically</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleCollapsed}
            className="btn btn-outline btn-sm flex items-center gap-1"
            title={isCollapsed ? 'Show details' : 'Hide details'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isCollapsed ? 'Show' : 'Hide'}
          </button>
          {isConnected && (
            <button
              onClick={handleSync}
              disabled={syncMutation.isLoading}
              className="btn btn-secondary btn-sm flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isLoading ? 'animate-spin' : ''}`} />
              Sync
            </button>
          )}
          {isConnected && (
            <button
              onClick={handleFetchCoursesAndSyncAll}
              disabled={isFetchingCourses || syncSelectedMutation.isLoading}
              className="btn btn-secondary btn-sm flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingCourses ? 'animate-spin' : ''}`} />
              {isFetchingCourses ? 'Fetching…' : 'Fetch courses & sync all'}
            </button>
          )}
          {!isCollapsed && isConnected && (
            <button
              onClick={() => { const next = !showCourseSelector; setShowCourseSelector(next); if (next) { refetchCourses(); } }}
              className="btn btn-outline btn-sm"
            >
              {showCourseSelector ? 'Hide courses' : 'Choose courses'}
            </button>
          )}
        </div>
      </div>

      {isCollapsed ? null : (!isConnected ? (
        <div className="text-center py-8">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Connect Google Classroom</h4>
          <p className="text-gray-600 mb-6">
            Sync your assignments, courses, and materials automatically from Google Classroom
          </p>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="btn btn-primary flex items-center gap-2 mx-auto"
          >
            <Link className="w-4 h-4" />
            {isConnecting ? 'Connecting...' : 'Connect Google Classroom'}
          </button>
          <div className="mt-4 text-xs text-gray-500">
            🔒 Your data is secure and only accessible to you
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Connected to Google Classroom</p>
                <p className="text-sm text-green-600">
                  Last sync: {formatLastSync(lastSync)}
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="btn btn-outline btn-sm text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Unlink className="w-4 h-4" />
              Disconnect
            </button>
          </div>

          {/* Courses Selection */}
          {showCourseSelector && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <h5 className="font-medium text-blue-800">Choose courses to sync</h5>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAllCourses} className="text-blue-700 hover:underline">Select all</button>
                  <span className="text-blue-300">|</span>
                  <button onClick={clearAllCourses} className="text-blue-700 hover:underline">Clear</button>
                </div>
              </div>
              {coursesLoading ? (
                <div className="text-sm text-blue-700">Loading courses…</div>
              ) : coursesError ? (
                <div className="text-sm text-red-700">Failed to load courses. Click 'Choose courses' to retry.</div>
              ) : (courses && courses.length > 0) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {courses.map((course) => (
                    <label key={course.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={selectedCourseIds.includes(course.id)}
                        onChange={() => toggleCourse(course.id)}
                      />
                      <span className="text-blue-700">{course.name}</span>
                      {course.section && (
                        <span className="text-blue-500 text-xs">({course.section})</span>
                      )}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-blue-700">No courses found for your account.</div>
              )}
            </div>
          )}

          {/* Sync Options */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h5 className="font-medium text-gray-800 mb-3">Sync Options</h5>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Assignments and due dates</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Course materials and resources</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Submission status and grades</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Real-time updates</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncMutation.isLoading || syncSelectedMutation.isLoading}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${(syncMutation.isLoading || syncSelectedMutation.isLoading) ? 'animate-spin' : ''}`} />
              {(syncMutation.isLoading || syncSelectedMutation.isLoading) ? 'Syncing...' : selectedCourseIds.length ? 'Sync Selected' : 'Sync All'}
            </button>
            <button
              onClick={() => window.open('https://classroom.google.com', '_blank')}
              className="btn btn-outline flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open Classroom
            </button>
            <button
              onClick={handleResetPreferences}
              className="btn btn-outline text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-2"
              title="Reset Classroom preferences"
            >
              <Trash2 className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

export default GoogleClassroomIntegration;
