import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Lightbulb, 
  Target, 
  Clock, 
  BookOpen, 
  MessageSquare,
  Send,
  Sparkles,
  LogOut
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const AIAssistant = () => {
  const [selectedFeature, setSelectedFeature] = useState('prioritize');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    {
      type: 'ai',
      message: "Hello! I'm your AI study assistant. I can analyze your Google Classroom assignments, suggest study plans, and help you prioritize tasks. What would you like to work on today?",
      timestamp: new Date()
    }
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamingSpeed, setStreamingSpeed] = useState(50); // milliseconds per word
  const [initialMessageSent, setInitialMessageSent] = useState(false);
  const { logout } = useAuth();

  // Function to simulate streaming effect for AI responses
  const streamResponse = (fullMessage, onComplete) => {
    setIsStreaming(true);
    setStreamingMessage('');
    
    let currentIndex = 0;
    const words = fullMessage.split(' ');
    
    const streamInterval = setInterval(() => {
      if (currentIndex < words.length) {
        setStreamingMessage(prev => prev + (currentIndex === 0 ? '' : ' ') + words[currentIndex]);
        currentIndex++;
      } else {
        clearInterval(streamInterval);
        setIsStreaming(false);
        onComplete();
      }
    }, streamingSpeed); // Use configurable speed
    
    return streamInterval;
  };

  // Function to format AI responses with proper styling
  const formatAIResponse = (message) => {
    if (!message) return '';
    
    // Split message into lines
    const lines = message.split('\n');
    
    return lines.map((line, index) => {
      // Main headings (##)
      if (line.startsWith('## ')) {
        return (
          <h2 key={index} className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0">
            {line.replace('## ', '')}
          </h2>
        );
      }
      
      // Sub headings (###)
      if (line.startsWith('### ')) {
        return (
          <h3 key={index} className="text-base font-semibold text-gray-800 mt-3 mb-2">
            {line.replace('### ', '')}
          </h3>
        );
      }
      
      // Bullet points
      if (line.trim().startsWith('• ')) {
        return (
          <div key={index} className="flex items-start gap-2 ml-4 mb-1">
            <span className="text-blue-500 mt-1">•</span>
            <span className="flex-1">{line.replace('• ', '')}</span>
          </div>
        );
      }
      
      // Numbered lists
      if (line.trim().match(/^\d+\./)) {
        return (
          <div key={index} className="flex items-start gap-2 ml-4 mb-1">
            <span className="text-blue-500 font-medium min-w-[20px]">
              {line.match(/^\d+\./)[0]}
            </span>
            <span className="flex-1">{line.replace(/^\d+\.\s*/, '')}</span>
          </div>
        );
      }
      
      // Bold text (**text**)
      if (line.includes('**')) {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={index} className="mb-2">
            {parts.map((part, partIndex) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={partIndex} className="font-semibold text-gray-900">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            })}
          </p>
        );
      }
      
      // Empty lines for spacing
      if (line.trim() === '') {
        return <div key={index} className="h-2" />;
      }
      
      // Regular text
      return (
        <p key={index} className="mb-2 text-gray-700">
          {line}
        </p>
      );
    });
  };

  // Fetch Google Classroom data
  const { data: classroomData, refetch: refetchClassroomData } = useQuery(
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
      staleTime: 300000, // 5 minutes
      retry: false
    }
  );

  // Fetch planner tasks
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
      staleTime: 60000, // 1 minute
      retry: false
    }
  );

  // Fetch user's timetable for free time analysis
  const { data: timetableData } = useQuery(
    'userTimetable',
    async () => {
      try {
        const response = await api.get('/api/user-timetable/my');
        return response.data;
      } catch (error) {
        return null;
      }
    },
    {
      staleTime: 300000, // 5 minutes
      retry: false
    }
  );

  // Update welcome message when data loads
  useEffect(() => {
    if (!initialMessageSent && (classroomData || plannerTasks)) {
      const assignmentCount = classroomData?.length || 0;
      const taskCount = plannerTasks?.length || 0;
      
      if (assignmentCount > 0 || taskCount > 0) {
        const updatedMessage = `Hello! I'm your AI study assistant. I can see you have ${assignmentCount} Google Classroom assignments and ${taskCount} planner tasks. I can help you prioritize, create study plans, and manage your time effectively. What would you like to work on today?`;
        
        setChatHistory(prev => [
          {
            type: 'ai',
            message: updatedMessage,
            timestamp: new Date()
          }
        ]);
      }
      setInitialMessageSent(true);
    }
  }, [classroomData, plannerTasks, initialMessageSent]);

  // Auto-refresh AI context when component mounts to ensure latest course selection
  useEffect(() => {
    const refreshTimer = setTimeout(() => {
      refetchClassroomData();
    }, 2000); // Wait 2 seconds for initial load, then refresh

    return () => clearTimeout(refreshTimer);
  }, [refetchClassroomData]);

  const aiFeatures = [
    {
      id: 'prioritize',
      title: 'Task Prioritization',
      description: 'Get AI-powered suggestions on what to study first',
      icon: Target,
      color: 'text-blue-600 bg-blue-50'
    },
    {
      id: 'study-plan',
      title: 'Study Roadmap',
      description: 'Create personalized study plans for your courses',
      icon: BookOpen,
      color: 'text-green-600 bg-green-50'
    },
    {
      id: 'time-management',
      title: 'Time Management',
      description: 'Optimize your schedule and study sessions',
      icon: Clock,
      color: 'text-purple-600 bg-purple-50'
    }
  ];

  // Enhanced AI responses with real data
  const getAIAnalysis = (feature) => {
    const now = new Date();
    const assignments = classroomData || [];
    const tasks = plannerTasks || [];
    const timetable = timetableData?.timetable;

    // Analyze assignments and tasks
    const upcomingAssignments = assignments.filter(a => {
      const dueDate = new Date(a.dueDate);
      const daysDiff = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff <= 7;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const overdueAssignments = assignments.filter(a => {
      const dueDate = new Date(a.dueDate);
      return dueDate < now && (!a.submission || a.submission.state !== 'TURNED_IN');
    });

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const highPriorityTasks = pendingTasks.filter(t => t.priority === 'high');

    switch (feature) {
      case 'prioritize':
        return {
          summary: `Analysis of ${assignments.length} assignments and ${tasks.length} tasks`,
          insights: [
            `${overdueAssignments.length} overdue assignments need immediate attention`,
            `${upcomingAssignments.length} assignments due this week`,
            `${highPriorityTasks.length} high-priority tasks in your planner`,
            `Estimated study time needed: ${Math.ceil(pendingTasks.reduce((sum, t) => sum + (t.estimatedTime || 60), 0) / 60)} hours`
          ],
          recommendations: [
            overdueAssignments.length > 0 ? "Start with overdue assignments immediately" : "Great! No overdue assignments",
            upcomingAssignments.length > 0 ? `Focus on "${upcomingAssignments[0]?.title}" due soon` : "No urgent deadlines this week",
            highPriorityTasks.length > 0 ? "Complete high-priority planner tasks first" : "Work on medium priority tasks",
            "Schedule study sessions during your free periods"
          ],
          urgentItems: [
            ...overdueAssignments.slice(0, 3).map(a => ({
              type: 'assignment',
              title: a.title,
              course: a.courseName,
              dueDate: a.dueDate,
              status: 'overdue'
            })),
            ...upcomingAssignments.slice(0, 2).map(a => ({
              type: 'assignment',
              title: a.title,
              course: a.courseName,
              dueDate: a.dueDate,
              status: 'upcoming'
            })),
            ...highPriorityTasks.slice(0, 2).map(t => ({
              type: 'task',
              title: t.title,
              category: t.category,
              dueDate: t.dueDate,
              status: 'high-priority'
            }))
          ]
        };

      case 'study-plan':
        const subjects = [...new Set(assignments.map(a => a.courseName).filter(Boolean))];
        const studyHours = timetable ? calculateFreeHours(timetable) : 4;
        
        return {
          summary: `Study plan for ${subjects.length} subjects with ${studyHours}h daily study time`,
          insights: [
            `${subjects.length} active courses detected`,
            `Recommended ${studyHours} hours of daily study`,
            `${upcomingAssignments.length} deadlines to prepare for`,
            `Best study times based on your timetable`
          ],
          recommendations: subjects.map(subject => {
            const subjectAssignments = assignments.filter(a => a.courseName === subject);
            const nextDeadline = subjectAssignments
              .filter(a => new Date(a.dueDate) > now)
              .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
            
            return {
              subject,
              timeAllocation: `${Math.ceil(studyHours / subjects.length)} hours/day`,
              focus: nextDeadline ? `Prepare for "${nextDeadline.title}"` : 'Review and practice',
              nextDeadline: nextDeadline?.dueDate
            };
          }),
          schedule: generateStudySchedule(timetable, subjects, studyHours)
        };

      case 'time-management':
        const totalEstimatedTime = pendingTasks.reduce((sum, t) => sum + (t.estimatedTime || 60), 0);
        const freeSlots = timetable ? getFreeTimeSlots(timetable) : [];
        
        return {
          summary: `${Math.ceil(totalEstimatedTime / 60)}h of pending work, ${freeSlots.length} free slots available`,
          insights: [
            `${freeSlots.length} free time slots identified in your timetable`,
            `${Math.ceil(totalEstimatedTime / 60)} hours of pending work`,
            `${pendingTasks.length} tasks need scheduling`,
            "Optimal study periods based on your schedule"
          ],
          recommendations: [
            "Use Pomodoro technique for better focus",
            "Schedule demanding tasks during peak energy hours",
            "Take breaks between different subjects",
            "Reserve buffer time for unexpected tasks"
          ],
          timeSlots: freeSlots.slice(0, 5).map(slot => ({
            day: slot.day,
            time: `${slot.start} - ${slot.end}`,
            duration: slot.duration,
            suggestion: slot.duration >= 120 ? "Deep work session" : "Quick review or light tasks"
          }))
        };

      default:
        return { 
          summary: "AI analysis not available", 
          insights: [], 
          recommendations: [],
          urgentItems: [],
          schedule: [],
          timeSlots: []
        };
    }
  };

  // Helper function to calculate free hours
  const calculateFreeHours = (timetable) => {
    if (!timetable?.classes) return 4;
    const classHours = timetable.classes.length;
    const totalWakingHours = 16; // Assuming 8 hours sleep
    const personalTime = 6; // Meals, commute, etc.
    return Math.max(2, totalWakingHours - classHours - personalTime);
  };

  // Helper function to get free time slots
  const getFreeTimeSlots = (timetable) => {
    if (!timetable?.classes) return [];
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeSlots = [
      '08:00-08:50', '09:00-09:50', '10:00-10:50', '11:00-11:50',
      '12:00-12:50', '13:00-13:50', '14:00-14:50', '15:00-15:50',
      '16:00-16:50', '17:00-17:50', '18:00-18:50', '19:00-19:50'
    ];

    const freeSlots = [];
    
    days.forEach(day => {
      const dayClasses = timetable.classes.filter(c => c.day === day);
      const occupiedSlots = dayClasses.map(c => c.timeSlot.startTime);
      
      timeSlots.forEach((slot, index) => {
        const startTime = slot.split('-')[0];
        if (!occupiedSlots.includes(startTime)) {
          // Check for consecutive free slots
          let duration = 50;
          let endSlot = index;
          
          while (endSlot + 1 < timeSlots.length) {
            const nextStart = timeSlots[endSlot + 1].split('-')[0];
            if (!occupiedSlots.includes(nextStart)) {
              duration += 50;
              endSlot++;
            } else {
              break;
            }
          }
          
          if (duration >= 50) { // At least one free period
            freeSlots.push({
              day,
              start: startTime,
              end: timeSlots[endSlot].split('-')[1],
              duration
            });
          }
        }
      });
    });
    
    return freeSlots.filter(slot => slot.duration >= 100); // At least 2 periods
  };

  // Helper function to generate study schedule
  const generateStudySchedule = (timetable, subjects, dailyHours) => {
    const hoursPerSubject = Math.ceil(dailyHours / subjects.length);
    const schedule = [];
    
    subjects.forEach((subject, index) => {
      schedule.push({
        time: `${8 + index * 2}:00 - ${8 + index * 2 + hoursPerSubject}:00`,
        subject,
        activity: "Study session",
        duration: `${hoursPerSubject} hour${hoursPerSubject > 1 ? 's' : ''}`
      });
    });
    
    return schedule;
  };

  // Mock AI responses for demo (fallback)
  const getAIResponse = (feature) => {
    const responses = {
      prioritize: {
        recommendations: [
          {
            task: 'Data Structures Lab Assignment',
            priority: 'High',
            reason: 'Due in 2 days and worth 20% of final grade',
            estimatedTime: '3-4 hours'
          },
          {
            task: 'Review Machine Learning concepts',
            priority: 'Medium',
            reason: 'Quiz next week, good foundation needed',
            estimatedTime: '2 hours'
          },
          {
            task: 'Engineering Drawing practice',
            priority: 'Low',
            reason: 'Due in 10 days, sufficient time available',
            estimatedTime: '1-2 hours daily'
          }
        ]
      },
      'study-plan': {
        subject: 'Machine Learning',
        plan: [
          {
            week: 1,
            topics: ['Linear Regression', 'Logistic Regression'],
            activities: ['Watch lectures', 'Complete assignments', 'Practice problems']
          },
          {
            week: 2,
            topics: ['Decision Trees', 'Random Forest'],
            activities: ['Implement algorithms', 'Work on project', 'Review concepts']
          },
          {
            week: 3,
            topics: ['Neural Networks', 'Deep Learning'],
            activities: ['Theory study', 'Practical implementation', 'Prepare for exam']
          }
        ]
      },
      'time-management': {
        suggestions: [
          {
            timeSlot: '9:00 AM - 10:00 AM',
            activity: 'Focus on Data Structures assignment',
            reason: 'Peak concentration time, tackle difficult tasks'
          },
          {
            timeSlot: '2:00 PM - 3:00 PM',
            activity: 'Review Machine Learning notes',
            reason: 'Good for reading and understanding concepts'
          },
          {
            timeSlot: '7:00 PM - 8:00 PM',
            activity: 'Practice Engineering Drawing',
            reason: 'Relaxed practice time, skill building'
          }
        ]
      }
    };
    return responses[feature];
  };

  const aiMutation = useMutation(
    async (feature) => {
      try {
        // First try to get real AI analysis from the backend
        const response = await api.post('/api/ai/chat', {
          message: `Please provide ${feature} recommendations based on my current assignments and tasks.`,
          conversationHistory: chatHistory.slice(-5), // Send last 5 messages for context
          feature: feature // Specify which feature we want
        });
        
        if (response.data && response.data.response) {
          return {
            type: 'ai_response',
            message: response.data.response,
            feature: feature
          };
        }
      } catch (error) {
        console.log('AI API failed, using local analysis:', error);
      }
      
      // Fallback to local analysis if API fails
      const analysisData = getAIAnalysis(feature);
      return {
        type: 'local_analysis',
        message: `Here are my AI-powered recommendations for ${feature.replace('-', ' ')} based on your current data:`,
        data: analysisData,
        feature: feature
      };
    },
    {
      onSuccess: (result) => {
        if (result.type === 'ai_response') {
          // AI API response
          setChatHistory(prev => [...prev, {
            type: 'ai',
            message: result.message,
            timestamp: new Date()
          }]);
        } else {
          // Local analysis response
          setChatHistory(prev => [...prev, {
            type: 'ai',
            message: result.message,
            data: result.data,
            timestamp: new Date()
          }]);
        }
        
        toast.success(`AI recommendations generated for ${result.feature.replace('-', ' ')}! 🎉`);
      },
      onError: (error) => {
        console.error('AI mutation error:', error);
        
        // Fallback to local analysis on error
        const fallbackData = getAIAnalysis(selectedFeature);
        setChatHistory(prev => [...prev, {
          type: 'ai',
          message: `I'm having trouble connecting to my AI services right now, but I can still help you with some analysis based on your current data. Here are my recommendations for ${selectedFeature.replace('-', ' ')}:`,
          data: fallbackData,
          timestamp: new Date()
        }]);
        
        toast.error('AI service temporarily unavailable. Using offline analysis.');
      }
    }
  );

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;

    const userMessage = chatMessage.trim();

    // Add user message
    setChatHistory(prev => [...prev, {
      type: 'user',
      message: userMessage,
      timestamp: new Date()
    }]);

    setIsAnalyzing(true);
    setChatMessage('');

    try {
      // Send message to AI API
      const response = await api.post('/api/ai/chat', {
        message: userMessage,
        conversationHistory: chatHistory.slice(-10) // Send last 10 messages for context
      });

      // Add AI response placeholder
      const aiResponseId = Date.now();
      setChatHistory(prev => [...prev, {
        id: aiResponseId,
        type: 'ai',
        message: '',
        timestamp: new Date()
      }]);

      // Stream the response
      streamResponse(response.data.response, () => {
        // Update the message with full content when streaming completes
        setChatHistory(prev => prev.map(chat => 
          chat.id === aiResponseId 
            ? { ...chat, message: response.data.response }
            : chat
        ));
      });

    } catch (error) {
      console.error('AI chat error:', error);
      
      // Fallback to local analysis if API fails
      const analysisData = getAIAnalysis('prioritize');
      const fallbackResponse = "I'm having trouble connecting to my AI services right now, but I can still help you with some basic analysis based on your current data.";
      
      setChatHistory(prev => [...prev, {
        type: 'ai',
        message: fallbackResponse,
        data: analysisData,
        timestamp: new Date()
      }]);

      toast.error('AI service temporarily unavailable. Using offline analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderAIRecommendations = (data, feature) => {
    if (!data) return null;

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <h4 className="font-medium text-blue-900 text-sm mb-1">📊 Analysis Summary</h4>
          <p className="text-blue-800 text-xs">{data.summary}</p>
        </div>

        {/* Insights */}
        {data.insights && data.insights.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-1">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              💡 Key Insights
            </h4>
            <ul className="space-y-1">
              {data.insights.map((insight, index) => (
                <li key={index} className="text-xs text-gray-700 flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Urgent Items */}
        {data.urgentItems && data.urgentItems.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-1">
              <Target className="w-4 h-4 text-red-500" />
              🚨 Priority Items
            </h4>
            <div className="space-y-2">
              {data.urgentItems.map((item, index) => (
                <div key={index} className={`p-2 rounded border text-xs ${
                  item.status === 'overdue' ? 'bg-red-50 border-red-200 text-red-800' :
                  item.status === 'upcoming' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                  'bg-purple-50 border-purple-200 text-purple-800'
                }`}>
                  <div className="font-medium">{item.title}</div>
                  <div className="opacity-75">
                    {item.course || item.category} • Due: {new Date(item.dueDate).toLocaleDateString()}
                  </div>
                  <div className="text-xs opacity-60 mt-1">
                    Status: {item.status.replace('-', ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Study Schedule */}
        {data.schedule && data.schedule.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-1">
              <Clock className="w-4 h-4 text-green-500" />
              📅 Recommended Schedule
            </h4>
            <div className="space-y-2">
              {data.schedule.map((slot, index) => (
                <div key={index} className="bg-green-50 border border-green-200 rounded p-2 text-xs">
                  <div className="font-medium text-green-900">{slot.time}</div>
                  <div className="text-green-800">{slot.subject} - {slot.activity}</div>
                  <div className="text-green-700 opacity-75">Duration: {slot.duration}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Time Slots */}
        {data.timeSlots && data.timeSlots.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-1">
              <Clock className="w-4 h-4 text-blue-500" />
              ⏰ Available Time Slots
            </h4>
            <div className="space-y-2">
              {data.timeSlots.map((slot, index) => (
                <div key={index} className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                  <div className="font-medium text-blue-900">{slot.day} {slot.time}</div>
                  <div className="text-blue-800">{slot.duration}min - {slot.suggestion}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-purple-500" />
              ✨ Actionable Recommendations
            </h4>
            <ul className="space-y-1">
              {data.recommendations.map((rec, index) => (
                <li key={index} className="text-xs text-gray-700 flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  {typeof rec === 'string' ? rec : `${rec.subject}: ${rec.timeAllocation} - ${rec.focus}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Feature-specific additional info */}
        {feature === 'prioritize' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <h4 className="font-medium text-orange-900 text-sm mb-1">🎯 Pro Tips</h4>
            <ul className="text-xs text-orange-800 space-y-1">
              <li>• Start with the most urgent items first</li>
              <li>• Break large tasks into smaller, manageable chunks</li>
              <li>• Use the Pomodoro technique for focused work</li>
              <li>• Review your progress at the end of each day</li>
            </ul>
          </div>
        )}

        {feature === 'study-plan' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h4 className="font-medium text-green-900 text-sm mb-1">📚 Study Strategy</h4>
            <ul className="text-xs text-green-800 space-y-1">
              <li>• Review previous material before starting new topics</li>
              <li>• Practice active recall techniques</li>
              <li>• Take regular breaks to maintain focus</li>
              <li>• Use spaced repetition for better retention</li>
            </ul>
          </div>
        )}

        {feature === 'time-management' && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <h4 className="font-medium text-purple-900 text-sm mb-1">⏱️ Time Management Tips</h4>
            <ul className="text-xs text-purple-800 space-y-1">
              <li>• Schedule your most important tasks during peak energy hours</li>
              <li>• Use time blocking to dedicate specific periods to tasks</li>
              <li>• Include buffer time for unexpected interruptions</li>
              <li>• Review and adjust your schedule weekly</li>
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Legacy render function for fallback
  const renderLegacyRecommendations = (data, feature) => {
    if (feature === 'prioritize') {
      return (
        <div className="space-y-3">
          {data.recommendations.map((rec, index) => (
            <div key={index} className="border rounded-lg p-3 bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900">{rec.task}</h4>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  rec.priority === 'High' ? 'bg-red-100 text-red-800' :
                  rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {rec.priority}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-1">{rec.reason}</p>
              <p className="text-xs text-gray-500">Estimated time: {rec.estimatedTime}</p>
            </div>
          ))}
        </div>
      );
    }

    if (feature === 'study-plan') {
      return (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">{data.subject} Study Plan</h4>
          {data.plan.map((week, index) => (
            <div key={index} className="border rounded-lg p-3 bg-gray-50">
              <h5 className="font-medium text-gray-800 mb-2">Week {week.week}</h5>
              <div className="space-y-1">
                <p className="text-sm"><strong>Topics:</strong> {week.topics.join(', ')}</p>
                <p className="text-sm"><strong>Activities:</strong> {week.activities.join(', ')}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (feature === 'time-management') {
      return (
        <div className="space-y-3">
          {data.suggestions.map((suggestion, index) => (
            <div key={index} className="border rounded-lg p-3 bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900">{suggestion.timeSlot}</h4>
              </div>
              <p className="text-sm text-gray-800 mb-1">{suggestion.activity}</p>
              <p className="text-xs text-gray-500">{suggestion.reason}</p>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="text-center sm:text-left">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 mx-auto sm:mx-0 rounded-full flex items-center justify-center mb-4"
          >
            <Brain className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Study Assistant</h1>
                     <p className="text-gray-600">Get personalized recommendations for better study management</p>
           
           {/* Streaming Speed Control */}
           <div className="flex items-center gap-2 mt-3">
             <label className="text-xs text-gray-500">AI Response Speed:</label>
             <select
               value={streamingSpeed}
               onChange={(e) => setStreamingSpeed(Number(e.target.value))}
               className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
             >
               <option value={30}>Fast</option>
               <option value={50}>Normal</option>
               <option value={80}>Slow</option>
             </select>
             
             {/* Refresh Data Button */}
             <button
               onClick={() => {
                 refetchClassroomData();
                 toast.success('Refreshing AI context data...');
               }}
               className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50 transition-colors"
               title="Refresh AI context with latest course selection"
             >
               🔄 Refresh
             </button>
           </div>
         </div>
        
        {/* Logout Button */}
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to logout?')) {
              logout();
            }
          }}
          className="btn btn-outline flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 mt-4 sm:mt-0"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      {/* AI Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {aiFeatures.map((feature) => (
          <motion.div
            key={feature.id}
            whileHover={{ scale: 1.02 }}
            className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
              selectedFeature === feature.id
                ? 'border-primary bg-primary-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => setSelectedFeature(feature.id)}
          >
            <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4`}>
              <feature.icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
            <p className="text-gray-600 text-sm">{feature.description}</p>
          </motion.div>
        ))}
      </div>

      {/* Selected Feature Description */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6 border border-blue-200">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {aiFeatures.find(f => f.id === selectedFeature)?.title} Analysis
          </h3>
          <p className="text-gray-700 mb-4">
            {selectedFeature === 'prioritize' && 
              "I'll analyze your assignments and tasks to identify what needs immediate attention, what's due soon, and help you prioritize your study sessions effectively."}
            {selectedFeature === 'study-plan' && 
              "I'll create a personalized study roadmap based on your courses, deadlines, and available time, helping you stay organized and on track."}
            {selectedFeature === 'time-management' && 
              "I'll analyze your schedule to find optimal study times, suggest time management strategies, and help you make the most of your available time."}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Click "Get AI Recommendations" below to start analysis</span>
          </div>
        </div>
      </div>

      {/* Get Recommendations Button */}
      <div className="text-center mb-8">
        <button
          onClick={() => {
            if (!classroomData && !plannerTasks) {
              toast.error('Please wait for data to load before getting recommendations');
              return;
            }
            aiMutation.mutate(selectedFeature);
          }}
          disabled={aiMutation.isLoading || !classroomData}
          className={`btn flex items-center gap-2 mx-auto ${
            aiMutation.isLoading || !classroomData
              ? 'bg-gray-400 cursor-not-allowed'
              : 'btn-primary hover:scale-105 transition-transform'
          }`}
        >
          {aiMutation.isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Analyzing your data...
            </>
          ) : !classroomData ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
              Loading data...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Get AI Recommendations
            </>
          )}
        </button>
        
        {/* Status indicator */}
        <div className="mt-2 text-sm text-gray-600">
          {!classroomData ? (
            <span className="text-orange-600">⏳ Loading your assignments...</span>
          ) : (
            <span className="text-green-600">
              ✅ Ready! {classroomData.length} assignments loaded
            </span>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            AI Chat Assistant
          </h2>
        </div>

        {/* Chat Messages */}
        <div className="h-96 overflow-y-auto overflow-x-hidden p-4 space-y-4">
          {chatHistory.map((chat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${chat.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                chat.type === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                                 <div className="text-sm whitespace-pre-wrap">
                   {chat.message ? (
                     formatAIResponse(chat.message)
                   ) : isStreaming && chat === chatHistory[chatHistory.length - 1] ? (
                     <motion.div 
                       className="flex items-center gap-2"
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       transition={{ duration: 0.3 }}
                     >
                       <span>{streamingMessage}</span>
                       <span className="animate-pulse text-blue-500">|</span>
                     </motion.div>
                   ) : null}
                 </div>
                {chat.data && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    {renderAIRecommendations(chat.data, selectedFeature)}
                  </div>
                )}
                                 {isAnalyzing && chat === chatHistory[chatHistory.length - 1] && (
                   <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                     <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                     {isStreaming ? 'AI is typing...' : 'Analyzing your data...'}
                   </div>
                 )}
                <p className="text-xs opacity-70 mt-1">
                  {chat.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

                 {/* Typing Indicator */}
         {isStreaming && (
           <div className="border-t border-gray-200 p-3 bg-gray-50">
             <div className="flex items-center gap-2 text-sm text-gray-600">
               <div className="flex space-x-1">
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
               </div>
               <span>AI is typing...</span>
             </div>
           </div>
         )}

         {/* Chat Input */}
         <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask me anything about study planning..."
              className="flex-1 input"
            />
            <button
              onClick={handleSendMessage}
              className="btn btn-primary px-4"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;