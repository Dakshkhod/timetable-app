import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from 'react-query';
import { 
  Calendar, 
  BookOpen, 
  Clock, 
  TrendingUp, 
  Plus,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock as ClockIcon,
  LogOut,
  Timer,
  Target,
  Users,
  Zap
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { format, isToday, isTomorrow, formatDistanceToNow } from 'date-fns';
import api from '../../services/api';
import { Bell, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const updatesRef = useRef(null);

  // Fetch real-time data using React Query
  const { data: timetableData } = useQuery(
    'userTimetable',
    async () => {
      const response = await api.get('/api/user-timetable/my');
      return response.data;
    },
    {
      refetchInterval: 300000, // 5 minutes
      staleTime: 60000 // 1 minute
    }
  );

  const { data: classroomData } = useQuery(
    'classroomAssignments',
    async () => {
      try {
        const response = await api.get('/api/google/assignments');
        return response.data.assignments || [];
      } catch (error) {
        return [];
      }
    },
    {
      refetchInterval: 300000, // 5 minutes
      retry: false
    }
  );

  const { data: plannerTasks } = useQuery(
    'plannerTasks',
    async () => {
      try {
        const response = await api.get('/api/planner/tasks');
        return response.data.tasks || [];
      } catch (error) {
        return [];
      }
    },
    {
      refetchInterval: 60000, // 1 minute
      retry: false
    }
  );

  const { data: announcements = [] } = useQuery(
    'announcements',
    async () => {
      try {
        const response = await api.get('/api/google/announcements');
        return response.data.announcements || [];
      } catch (error) {
        return [];
      }
    },
    {
      refetchInterval: 300000, // 5 minutes
      retry: false
    }
  );

  // Read selected Google Classroom course ids from localStorage (persisted by GoogleClassroomIntegration)
  const selectedCourseIds = useMemo(() => {
    try {
      const raw = localStorage.getItem('gc_selected_courses');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }, []);

  // Filter Classroom assignments to only selected courses (if any selected)
  const filteredClassroomData = useMemo(() => {
    if (!Array.isArray(classroomData)) return [];
    if (!selectedCourseIds.length) return classroomData;
    return classroomData.filter((a) => {
      const courseId = (a.course && a.course.id) || a.courseId;
      return selectedCourseIds.includes(courseId);
    });
  }, [classroomData, selectedCourseIds]);

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const markAnnouncementsSeen = () => {
    const latestTime = announcements[0]?.updatedAt || announcements[0]?.createdAt;
    if (latestTime) {
      localStorage.setItem('gc_last_seen_announcement_at', String(new Date(latestTime).getTime()));
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Get last seen timestamp for announcements
  const lastSeenMs = useMemo(() => {
    const lastSeen = localStorage.getItem('gc_last_seen_announcement_at');
    return lastSeen ? parseInt(lastSeen, 10) : 0;
  }, []);

  // Compute today's classes from timetable (must be defined before using in nextClass)
  const todayClasses = useMemo(() => {
    if (!timetableData?.timetable?.classes) return [];
    
    const today = format(currentTime, 'EEEE'); // Get day name
    return timetableData.timetable.classes
      .filter(cls => cls.day === today)
      .map(cls => ({
        id: cls._id,
        subject: cls.subject,
        time: cls.timeSlot.startTime,
        duration: `${cls.timeSlot.endTime} - ${cls.timeSlot.startTime}`,
        room: cls.room,
        type: cls.type,
        color: cls.color
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [timetableData, currentTime]);

  // Next upcoming class (computed AFTER todayClasses)
  const nextClass = useMemo(() => {
    const now = currentTime;
    for (const cls of todayClasses) {
      const [hours, minutes] = cls.time.split(':');
      const classTime = new Date(now);
      classTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      if (classTime > now) return cls;
    }
    return null;
  }, [todayClasses, currentTime]);

  // Compute upcoming assignments from both sources
  const upcomingAssignments = useMemo(() => {
    const assignments = [];
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Add Google Classroom assignments (respect course selection)
    if (filteredClassroomData) {
      filteredClassroomData.forEach(assignment => {
        const dueDate = new Date(assignment.dueDate);
        if (dueDate >= now && dueDate <= nextWeek) {
          assignments.push({
            id: `gc-${assignment.id}`,
            title: assignment.title,
            subject: (assignment.course && assignment.course.name) || assignment.courseName || 'Classroom',
            dueDate,
            priority: dueDate.getTime() - now.getTime() < 2 * 24 * 60 * 60 * 1000 ? 'high' : 'medium',
            source: 'classroom'
          });
        }
      });
    }

    // Add planner tasks
    if (plannerTasks) {
      plannerTasks.forEach(task => {
        const dueDate = new Date(task.dueDate);
        if (task.status === 'pending' && dueDate >= now && dueDate <= nextWeek) {
          assignments.push({
            id: `task-${task._id}`,
            title: task.title,
            subject: task.category,
            dueDate,
            priority: task.priority,
            source: 'planner'
          });
        }
      });
    }

    return assignments
      .sort((a, b) => a.dueDate - b.dueDate)
      .slice(0, 5); // Show top 5
  }, [classroomData, plannerTasks]);

  // Compute real-time stats
  const stats = useMemo(() => {
    const now = new Date();
    const pendingPlannerTasks = plannerTasks?.filter(t => t.status === 'pending') || [];
    const classroomPending = filteredClassroomData?.filter(a => (!a.submission || a.submission.state !== 'TURNED_IN')) || [];
    const overdueAssignments = filteredClassroomData?.filter(a => {
      const dueDate = new Date(a.dueDate);
      return dueDate < now && (!a.submission || a.submission.state !== 'TURNED_IN');
    }) || [];
    const totalPending = pendingPlannerTasks.length + classroomPending.length;
    
    // Calculate free time slots
    const totalTimeSlots = 12; // 8 AM to 8 PM
    const occupiedSlots = todayClasses.length;
    const freeSlots = totalTimeSlots - occupiedSlots;

    const baseStats = [
      {
        name: 'Today\'s Classes',
        value: todayClasses.length,
        icon: Calendar,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        onClick: () => window.location.href = '/timetable'
      },
      {
        name: 'Pending Tasks',
        value: totalPending,
        icon: Target,
        color: overdueAssignments.length > 0 ? 'text-red-600' : 'text-yellow-600',
        bgColor: overdueAssignments.length > 0 ? 'bg-red-50' : 'bg-yellow-50',
        onClick: () => window.location.href = '/assignments'
      },
      {
        name: 'Free Time Slots',
        value: freeSlots,
        icon: Timer,
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      },
      {
        name: 'Active Courses',
        value: [...new Set((filteredClassroomData || []).map(a => (a.course && a.course.name) || a.courseName).filter(Boolean))].length,
        icon: Users,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50'
      }
    ];

    // Add updates notification stat if there are new announcements
    const newUpdatesCount = announcements.filter(a => {
      const t = new Date(a.updatedAt || a.createdAt).getTime();
      return t > lastSeenMs;
    }).length;

    if (newUpdatesCount > 0) {
      const updatesStat = {
        name: 'New Updates',
        value: newUpdatesCount,
        icon: Bell,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        onClick: () => {
          if (updatesRef.current) {
            updatesRef.current.scrollIntoView({ behavior: 'smooth' });
            localStorage.setItem('gc_last_seen_announcement_at', Date.now().toString());
          }
        }
      };
      return [updatesStat, ...baseStats];
    }

    return baseStats;
  }, [todayClasses, plannerTasks, filteredClassroomData, announcements, lastSeenMs]);



  const quickActions = [
    { 
      name: 'Study Timer', 
      icon: Timer, 
      color: 'bg-red-600',
      href: '/study-timer'
    },
    { 
      name: 'Planner', 
      icon: Calendar, 
      color: 'bg-green-600',
      href: '/planner'
    },
    { 
      name: 'AI Assistant', 
      icon: Zap, 
      color: 'bg-purple-600',
      href: '/ai-assistant'
    },
    { 
      name: 'View Timetable', 
      icon: BookOpen, 
      color: 'bg-blue-600',
      href: '/timetable'
    }
  ];

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">
                {getGreeting()}, {user?.name?.split(' ')[0]}! 👋
              </h1>
              <p className="text-primary-100 mt-1">
                {format(currentTime, 'EEEE, MMMM do, yyyy')} • {format(currentTime, 'h:mm a')}
              </p>
            </div>
            
            {/* Mobile Logout Button */}
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to logout?')) {
                  logout();
                }
              }}
              className="md:hidden p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors duration-200"
              title="Logout"
            >
              <LogOut className="h-5 w-5 text-white" />
            </button>
          </div>
          <div className="hidden md:block">
            <div className="text-right">
              <p className="text-sm text-primary-200">Next Class</p>
              {nextClass ? (
                <p className="text-lg font-semibold">{nextClass.subject}</p>
              ) : (
                <p className="text-lg font-semibold">No more classes today</p>
              )}
            </div>
          </div>
          
          {/* Logout Button */}
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to logout?')) {
                logout();
              }
            }}
            className="md:hidden p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors duration-200"
            title="Logout"
          >
            <LogOut className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card hover:shadow-md transition cursor-pointer" 
              onClick={stat.onClick}
            >
              <div className="card-body">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-secondary-600">{stat.name}</p>
                    <p className="text-2xl font-bold text-secondary-900">{stat.value}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Today's Schedule */}
        <div className="xl:col-span-8">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-secondary-900">Today's Schedule</h2>
            </div>
            <div className="card-body">
              {todayClasses.length > 0 ? (
                <div className="space-y-4">
                  {todayClasses.map((cls) => (
                    <div key={cls.id} className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                            <Calendar className="h-6 w-6 text-primary-600" />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-secondary-900">{cls.subject}</h3>
                          <p className="text-sm text-secondary-500">{cls.room} • {cls.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-secondary-900">{cls.time}</p>
                        <p className="text-xs text-secondary-500">{cls.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-secondary-400" />
                  <h3 className="mt-2 text-sm font-medium text-secondary-900">No classes today</h3>
                  <p className="mt-1 text-sm text-secondary-500">Enjoy your free time!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Updates, Upcoming & Quick Actions */}
        <div className="xl:col-span-4 space-y-6">
          {/* Latest Classroom Updates - moved to top */}
          <div ref={updatesRef} className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary-600" /> Latest Classroom Updates
              </h2>
              <button onClick={markAnnouncementsSeen} className="text-xs text-primary-600 hover:text-primary-700">Mark as read</button>
            </div>
            <div className="card-body">
              {announcements.length ? (
                <div className="space-y-3">
                  {announcements.map((a) => (
                    <a key={a.id} href={a.alternateLink || '#'} target="_blank" rel="noreferrer" className="block p-3 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-secondary-900 truncate">{a.text || 'Announcement'}</p>
                          <p className="text-xs text-secondary-500 truncate">{a.course?.name || 'Google Classroom'} • {a.updatedAt || a.createdAt ? `${formatDistanceToNow(new Date(a.updatedAt || a.createdAt))} ago` : ''}</p>
                        </div>
                        {(function(){
                          const t = new Date(a.updatedAt || a.createdAt).getTime();
                          return t > lastSeenMs ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs">
                              <Sparkles className="w-3 h-3" /> New
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-secondary-600">No recent updates</p>
              )}
            </div>
          </div>
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-secondary-900">Quick Actions</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={action.name}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => action.href && (window.location.href = action.href)}
                      className="flex flex-col items-center p-4 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-all duration-200"
                    >
                      <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center mb-2`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-xs font-medium text-secondary-700 text-center">{action.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Upcoming Assignments */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-secondary-900">Upcoming Deadlines</h2>
            </div>
            <div className="card-body">
              {upcomingAssignments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAssignments.slice(0, 3).map((assignment) => {
                    const daysUntil = Math.ceil((assignment.dueDate - currentTime) / (1000 * 60 * 60 * 24));
                    const isUrgent = daysUntil <= 2;
                    const isTomorrow = daysUntil === 1;
                    
                    return (
                      <div key={assignment.id} className="flex items-center space-x-3 p-3 bg-secondary-50 rounded-lg">
                        <div className="flex-shrink-0">
                          {isUrgent ? (
                            <AlertCircle className="h-5 w-5 text-danger-500" />
                          ) : (
                            <ClockIcon className="h-5 w-5 text-warning-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-secondary-900 truncate">
                            {assignment.title}
                          </p>
                          <p className="text-xs text-secondary-500">
                            {assignment.subject} • {assignment.type}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            isUrgent ? 'bg-danger-100 text-danger-800' : 'bg-warning-100 text-warning-800'
                          }`}>
                            {isTomorrow ? 'Tomorrow' : `${daysUntil} days`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <button className="w-full mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center">
                    View all assignments
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle className="mx-auto h-8 w-8 text-success-500" />
                  <h3 className="mt-2 text-sm font-medium text-secondary-900">All caught up!</h3>
                  <p className="mt-1 text-sm text-secondary-500">No upcoming deadlines</p>
                </div>
              )}
            </div>
          </div>

          {/* Study Tips */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-secondary-900">Today's Study Tip</h2>
            </div>
            <div className="card-body">
              <div className="bg-gradient-to-r from-success-50 to-primary-50 p-6 rounded-lg border border-success-200">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-success-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-success-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-success-900">Use the Pomodoro Technique</h3>
                    <p className="mt-2 text-success-700">
                      Break your study sessions into 25-minute focused intervals followed by 5-minute breaks. 
                      This helps maintain concentration and prevents mental fatigue.
                    </p>
                    <div className="mt-4 flex space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                        Productivity
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        Focus
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      
    </div>
  );
};

export default Dashboard; 