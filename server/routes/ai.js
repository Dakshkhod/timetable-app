const express = require('express');
const { MockAssignment: Assignment, MockTimetable: Timetable, MockUser: User } = require('../models/User-mock');
const auth = require('../middleware/auth');
const GoogleClassroomService = require('../services/googleClassroom');
const { refreshAccessToken } = require('../config/google');

const router = express.Router();

// AI Chat endpoint - integrates with OpenAI/Gemini API
// @route   POST /api/ai/chat
// @desc    Chat with AI assistant using user context
// @access  Private
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userId = req.user.userId;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid message',
        message: 'Message is required and must be a string'
      });
    }

    // Get user context
    const user = await User.findById(userId);
    const context = await getUserContext(user);

    // Generate AI response
    const aiResponse = await generateAIResponse(message, context, conversationHistory);

    res.json({
      response: aiResponse,
      timestamp: new Date(),
      message: 'AI response generated successfully'
    });

  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      error: 'Failed to generate AI response',
      message: error.message
    });
  }
});

// @route   POST /api/ai/prioritize
// @desc    Get AI-powered task prioritization
// @access  Private
router.post('/prioritize', auth, async (req, res) => {
  try {
    const { date, freeSlots } = req.body;
    const userId = req.user.userId;

    // Get user's pending assignments
    const assignments = await Assignment.find({
      assignedTo: userId,
      status: { $in: ['Not Started', 'In Progress'] }
    }).sort({ dueDate: 1 });

    if (assignments.length === 0) {
      return res.json({
        message: 'No pending assignments found',
        suggestions: []
      });
    }

    // Calculate priority scores and create suggestions
    const suggestions = assignments.map(assignment => {
      const urgencyScore = assignment.urgencyScore;
      const estimatedTime = assignment.estimatedHours || 2; // Default 2 hours
      
      // Calculate priority score based on multiple factors
      let priorityScore = urgencyScore;
      
      // Bonus for assignments that can fit in available free slots
      if (freeSlots && freeSlots.length > 0) {
        const totalFreeTime = freeSlots.reduce((total, slot) => {
          const start = new Date(`2000-01-01T${slot.start}`);
          const end = new Date(`2000-01-01T${slot.end}`);
          return total + (end - start) / (1000 * 60 * 60); // Convert to hours
        }, 0);
        
        if (estimatedTime <= totalFreeTime) {
          priorityScore += 2; // Bonus for assignments that fit in free time
        }
      }

      return {
        assignment: {
          id: assignment._id,
          title: assignment.title,
          subject: assignment.subject,
          dueDate: assignment.dueDate,
          priority: assignment.priority,
          difficulty: assignment.difficulty,
          estimatedHours: estimatedTime
        },
        priorityScore,
        urgencyScore,
        recommendation: getRecommendation(urgencyScore, estimatedTime, assignment.difficulty),
        timeSlot: findBestTimeSlot(assignment, freeSlots)
      };
    });

    // Sort by priority score (highest first)
    suggestions.sort((a, b) => b.priorityScore - a.priorityScore);

    // Limit to top 5 suggestions
    const topSuggestions = suggestions.slice(0, 5);

    res.json({
      date,
      totalAssignments: assignments.length,
      suggestions: topSuggestions,
      message: 'Task prioritization completed successfully'
    });

  } catch (error) {
    console.error('AI prioritization error:', error);
    res.status(500).json({
      error: 'Failed to prioritize tasks',
      message: error.message
    });
  }
});

// @route   POST /api/ai/study-plan
// @desc    Generate personalized study roadmap for a course
// @access  Private
router.post('/study-plan', auth, async (req, res) => {
  try {
    const { subject, subjectCode } = req.body;
    const userId = req.user.userId;

    // Get all assignments for this subject
    const assignments = await Assignment.find({
      assignedTo: userId,
      subject: subject,
      status: { $ne: 'Completed' }
    }).sort({ dueDate: 1 });

    // Get user's timetable to understand class schedule
    const user = req.userProfile;
    const timetable = await Timetable.findOne({
      branch: user.branch,
      year: user.year,
      isActive: true
    });

    if (!timetable) {
      return res.status(404).json({
        error: 'Timetable not found',
        message: 'Unable to generate study plan without timetable'
      });
    }

    // Find classes for this subject
    const subjectClasses = timetable.classes.filter(cls => 
      cls.subject === subject || cls.subjectCode === subjectCode
    );

    // Generate study plan
    const studyPlan = generateStudyPlan(subject, assignments, subjectClasses);

    res.json({
      subject,
      subjectCode,
      studyPlan,
      totalAssignments: assignments.length,
      upcomingDeadlines: assignments.slice(0, 3).map(a => ({
        title: a.title,
        dueDate: a.dueDate,
        type: a.type,
        priority: a.priority
      })),
      message: 'Study plan generated successfully'
    });

  } catch (error) {
    console.error('Study plan generation error:', error);
    res.status(500).json({
      error: 'Failed to generate study plan',
      message: error.message
    });
  }
});

// @route   POST /api/ai/time-management
// @desc    Get smart time management advice
// @access  Private
router.post('/time-management', auth, async (req, res) => {
  try {
    const { date, freeSlots } = req.body;
    const userId = req.user.userId;

    // Get user's assignments and timetable
    const assignments = await Assignment.find({
      assignedTo: userId,
      status: { $in: ['Not Started', 'In Progress'] }
    });

    const user = req.userProfile;
    const timetable = await Timetable.findOne({
      branch: user.branch,
      year: user.year,
      isActive: true
    });

    if (!timetable) {
      return res.status(404).json({
        error: 'Timetable not found',
        message: 'Unable to provide time management advice without timetable'
      });
    }

    // Generate time management advice
    const advice = generateTimeManagementAdvice(assignments, freeSlots, timetable);

    res.json({
      date,
      advice,
      message: 'Time management advice generated successfully'
    });

  } catch (error) {
    console.error('Time management advice error:', error);
    res.status(500).json({
      error: 'Failed to generate time management advice',
      message: error.message
    });
  }
});

// Helper functions
function getRecommendation(urgencyScore, estimatedTime, difficulty) {
  if (urgencyScore >= 8) {
    return 'Start immediately - high priority and urgent deadline';
  } else if (urgencyScore >= 6) {
    return 'Begin today - important task with approaching deadline';
  } else if (urgencyScore >= 4) {
    return 'Plan for this week - moderate priority';
  } else {
    return 'Schedule for later - low priority, can wait';
  }
}

function findBestTimeSlot(assignment, freeSlots) {
  if (!freeSlots || freeSlots.length === 0) return null;

  const estimatedHours = assignment.estimatedHours || 2;
  
  // Find slots that can accommodate the assignment
  const suitableSlots = freeSlots.filter(slot => {
    const start = new Date(`2000-01-01T${slot.start}`);
    const end = new Date(`2000-01-01T${slot.end}`);
    const slotDuration = (end - start) / (1000 * 60 * 60);
    return slotDuration >= estimatedHours;
  });

  if (suitableSlots.length === 0) return null;

  // Return the first suitable slot (could be enhanced with more logic)
  return suitableSlots[0];
}

function generateStudyPlan(subject, assignments, subjectClasses) {
  const plan = {
    overview: `Comprehensive study plan for ${subject}`,
    phases: [],
    dailyRoutine: [],
    tips: []
  };

  // Phase 1: Foundation (if early in semester)
  if (assignments.length > 0) {
    const firstDueDate = new Date(assignments[0].dueDate);
    const now = new Date();
    const daysUntilFirst = Math.ceil((firstDueDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilFirst > 14) {
      plan.phases.push({
        name: 'Foundation Phase',
        duration: '2 weeks',
        focus: 'Understanding core concepts and building fundamentals',
        activities: [
          'Review lecture notes and textbooks',
          'Solve practice problems',
          'Create concept maps',
          'Join study groups'
        ]
      });
    }
  }

  // Phase 2: Application
  plan.phases.push({
    name: 'Application Phase',
    duration: 'Ongoing',
    focus: 'Applying concepts through assignments and projects',
    activities: [
      'Complete assignments on time',
      'Practice with real-world examples',
      'Review and revise work',
      'Seek feedback from professors'
    ]
  });

  // Phase 3: Review and Preparation
  plan.phases.push({
    name: 'Review Phase',
    duration: 'Before exams',
    focus: 'Comprehensive review and exam preparation',
    activities: [
      'Create summary notes',
      'Practice past exam questions',
      'Group study sessions',
      'Mock tests and assessments'
    ]
  });

  // Daily routine based on class schedule
  if (subjectClasses.length > 0) {
    plan.dailyRoutine = [
      'Review previous day\'s material (30 min)',
      'Preview today\'s topics (15 min)',
      'Attend classes actively',
      'Review and organize notes (45 min)',
      'Practice problems (1 hour)',
      'Plan next day\'s study (15 min)'
    ];
  }

  // Study tips
  plan.tips = [
    'Use active learning techniques (explaining concepts to others)',
    'Break large topics into smaller, manageable chunks',
    'Use spaced repetition for better retention',
    'Connect new concepts to what you already know',
    'Take regular breaks (Pomodoro technique)',
    'Maintain a study journal to track progress'
  ];

  return plan;
}

function generateTimeManagementAdvice(assignments, freeSlots, timetable) {
  const advice = {
    general: [],
    specific: [],
    productivity: []
  };

  // General advice
  if (assignments.length > 5) {
    advice.general.push('You have many pending assignments. Consider using the Eisenhower Matrix to prioritize.');
  }

  if (freeSlots && freeSlots.length > 0) {
    advice.general.push(`You have ${freeSlots.length} free time slots today. Use them wisely for focused study.`);
  }

  // Specific advice based on assignments
  const urgentAssignments = assignments.filter(a => a.priority === 'Urgent' || a.daysUntilDue <= 1);
  if (urgentAssignments.length > 0) {
    advice.specific.push(`Focus on ${urgentAssignments.length} urgent assignment(s) first. Delegate or postpone less critical tasks.`);
  }

  // Productivity advice
  advice.productivity = [
    'Use your most productive hours for complex tasks',
    'Batch similar tasks together to reduce context switching',
    'Set specific, achievable goals for each study session',
    'Eliminate distractions during focused work time',
    'Take regular breaks to maintain mental clarity',
    'Review and adjust your schedule weekly'
  ];

  return advice;
}

// Helper function to get user context for AI
async function getUserContext(user) {
  try {
    const context = {
      user: {
        name: user.name,
        email: user.email,
        branch: user.branch,
        year: user.year
      },
      assignments: [],
      timetable: null,
      plannerTasks: []
    };

    // Get Google Classroom assignments if connected
    if (user.googleAuth?.isConnected && user.googleAuth?.accessToken) {
      try {
        let accessToken = user.googleAuth.accessToken;
        
        // Check if token needs refresh
        if (user.googleAuth.tokenExpiry && new Date() > user.googleAuth.tokenExpiry) {
          const newTokens = await refreshAccessToken(user.googleAuth.refreshToken);
          accessToken = newTokens.access_token;
          
          await User.findByIdAndUpdate(user._id, {
            'googleAuth.accessToken': newTokens.access_token,
            'googleAuth.tokenExpiry': newTokens.expiry_date
          });
        }

        const classroomService = new GoogleClassroomService(accessToken);
        const assignments = await classroomService.getAllAssignments();
        
        // Filter by selected courses if any
        const selectedCourseIds = user.googlePreferences?.selectedCourseIds || [];
        
        // Enhanced filtering with better logging
        let filteredAssignments;
        if (selectedCourseIds.length > 0) {
          filteredAssignments = assignments.filter(a => {
            const courseId = a.course?.id;
            const isSelected = selectedCourseIds.includes(courseId);
            if (!isSelected) {
              console.log(`Filtered out assignment "${a.title}" from course "${a.course?.name}" (ID: ${courseId})`);
            }
            return isSelected;
          });
        } else {
          filteredAssignments = assignments;
          console.log('No course selection found, showing all assignments');
        }

        // Log for debugging
        console.log(`AI Context: Total assignments: ${assignments.length}, Selected courses: ${selectedCourseIds.length}, Filtered: ${filteredAssignments.length}`);
        console.log('Selected course IDs:', selectedCourseIds);
        console.log('Available course IDs:', assignments.map(a => a.course?.id).filter(Boolean));

        context.assignments = filteredAssignments.map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          courseName: a.course?.name,
          dueDate: a.dueDate,
          submission: a.submission,
          maxPoints: a.maxPoints
        }));
      } catch (error) {
        console.error('Error fetching Google Classroom data for AI context:', error);
      }
    }

    // Get user's timetable
    try {
      // Using MockAssignment from top of file
      const plannerTasks = await Assignment.find({
        assignedTo: user._id,
        status: { $ne: 'Completed' }
      }).sort({ dueDate: 1 }).limit(20);

      context.plannerTasks = plannerTasks.map(t => ({
        id: t._id,
        title: t.title,
        subject: t.subject,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
        estimatedHours: t.estimatedHours
      }));
    } catch (error) {
      console.error('Error fetching planner tasks for AI context:', error);
    }

    return context;
  } catch (error) {
    console.error('Error building user context:', error);
    return { user: { name: user.name }, assignments: [], timetable: null, plannerTasks: [] };
  }
}

// AI Response Generator - Uses OpenAI API or fallback to rule-based responses
async function generateAIResponse(message, context, conversationHistory) {
  try {
    // Try OpenAI API first
    if (process.env.OPENAI_API_KEY) {
      return await generateOpenAIResponse(message, context, conversationHistory);
    }
    
    // Fallback to rule-based intelligent responses
    return generateIntelligentResponse(message, context, conversationHistory);
  } catch (error) {
    console.error('Error generating AI response:', error);
    return generateIntelligentResponse(message, context, conversationHistory);
  }
}

// OpenAI API integration
async function generateOpenAIResponse(message, context, conversationHistory) {
  // Use global fetch if available, otherwise lazy-load node-fetch
  let fetchFn = global.fetch;
  if (!fetchFn) {
    const { default: nodeFetch } = await import('node-fetch');
    fetchFn = nodeFetch;
  }
  
  const systemPrompt = `You are an AI study assistant integrated into a student timetable management system. You have access to the student's:

- Google Classroom assignments and courses
- Personal planner tasks
- Academic schedule and timetable
- Study progress and deadlines

Student Context:
- Name: ${context.user.name}
- Branch: ${context.user.branch || 'Not specified'}
- Year: ${context.user.year || 'Not specified'}
- Assignments: ${context.assignments.length} active assignments
- Planner Tasks: ${context.plannerTasks.length} pending tasks

Current Assignments:
${context.assignments.slice(0, 5).map(a => `- ${a.title} (${a.courseName}) - Due: ${a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'No due date'}`).join('\n')}

Planner Tasks:
${context.plannerTasks.slice(0, 5).map(t => `- ${t.title} (${t.subject}) - Priority: ${t.priority} - Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No due date'}`).join('\n')}

IMPORTANT: Format your responses like ChatGPT with:
- Clear headings using ## and ###
- Bullet points with • for lists
- Bold text using ** for emphasis
- Emojis for visual appeal
- Proper spacing and structure
- Actionable, specific advice

Provide helpful, personalized study advice, task prioritization, time management tips, and academic guidance. Be conversational but informative. Focus on actionable suggestions based on their actual data.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10).map(h => ({
      role: h.type === 'user' ? 'user' : 'assistant',
      content: h.message
    })),
    { role: 'user', content: message }
  ];

  const response = await fetchFn('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Intelligent rule-based response generator (fallback)
function generateIntelligentResponse(message, context, conversationHistory) {
  const msg = message.toLowerCase();
  const { assignments, plannerTasks, user } = context;
  
  // Analyze current workload
  const now = new Date();
  const upcomingAssignments = assignments.filter(a => {
    if (!a.dueDate) return false;
    const dueDate = new Date(a.dueDate);
    const daysDiff = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    return daysDiff >= 0 && daysDiff <= 7;
  });
  
  const overdueAssignments = assignments.filter(a => {
    if (!a.dueDate) return false;
    const dueDate = new Date(a.dueDate);
    return dueDate < now && (!a.submission || a.submission.state !== 'TURNED_IN');
  });

  const highPriorityTasks = plannerTasks.filter(t => t.priority === 'High' || t.priority === 'Urgent');

  // Enhanced query handling with more intelligent responses
  if (msg.includes('priority') || msg.includes('prioritize') || msg.includes('what should i focus')) {
    if (overdueAssignments.length > 0) {
      return `## 🚨 Priority Alert: Overdue Assignments

Hi ${user.name}! You have **${overdueAssignments.length} overdue assignment(s)** that need immediate attention.

### 📋 **Immediate Action Required:**
${overdueAssignments.slice(0, 3).map(a => `• **${a.title}** (${a.courseName})  
  ⏰ Was due: ${new Date(a.dueDate).toLocaleDateString()}`).join('\n')}

### 🎯 **Recommendation:**
Start with these overdue assignments **right away** to get back on track. Focus on one at a time to avoid feeling overwhelmed.`;
    } else if (upcomingAssignments.length > 0) {
      return `## ✅ Great News: No Overdue Assignments!

Your Google Classroom is up to date! Here's what to focus on this week:

### 📅 **This Week's Priorities:**
${upcomingAssignments.slice(0, 3).map(a => `• **${a.title}** (${a.courseName})  
  ⏰ Due: ${new Date(a.dueDate).toLocaleDateString()}`).join('\n')}

### 🎯 **Action Plan:**
1. Start with the **earliest deadline** first
2. Work through the list systematically
3. Don't wait until the last minute!`;
    } else if (highPriorityTasks.length > 0) {
      return `## 📚 Focus on High-Priority Tasks

Your Google Classroom is up to date! Now focus on these high-priority planner tasks:

### 🔥 **High Priority Items:**
${highPriorityTasks.slice(0, 3).map(t => `• **${t.title}** (${t.subject})`).join('\n')}

### 💡 **Why This Matters:**
These tasks will help you stay ahead of your coursework and maintain good academic standing.`;
    } else {
      return `## 🎉 Excellent Work: You're All Caught Up!

No urgent tasks or overdue assignments. This is a perfect time to:

### 📖 **Recommended Activities:**
• **Review previous material** for better understanding
• **Work on long-term projects** to get ahead
• **Prepare for upcoming exams** proactively
• **Organize your study materials** and notes

### 🚀 **Pro Tip:**
Use this free time to build a strong foundation for future coursework.`;
    }
  }

  if (msg.includes('study plan') || msg.includes('schedule') || msg.includes('plan my day')) {
    const totalTasks = assignments.length + plannerTasks.length;
    const subjects = [...new Set([...assignments.map(a => a.courseName), ...plannerTasks.map(t => t.subject)].filter(Boolean))];
    
    return `## 📚 Personalized Study Plan

Based on your **${totalTasks} active tasks** across **${subjects.length} subjects**.

### 🎯 **Today's Focus:**
${upcomingAssignments.slice(0, 2).map(a => `• **${a.title}**  
  📅 Due: ${new Date(a.dueDate).toLocaleDateString()}`).join('\n') || '• Review and organize your study materials'}

### 📅 **This Week's Schedule:**
${upcomingAssignments.slice(2, 5).map(a => `• **${a.title}** (${a.courseName})`).join('\n') || '• Work on long-term projects'}

### 💡 **Study Tips:**
• **Pomodoro Technique**: 25-min focused sessions with 5-min breaks
• **Peak Performance**: Start with challenging tasks when you're fresh
• **Subject Rotation**: Take breaks between different subjects
• **Active Learning**: Explain concepts to yourself or others`;
  }

  if (msg.includes('time') || msg.includes('manage') || msg.includes('when should i')) {
    return `## ⏰ Time Management Strategy

Based on your current workload, here's your personalized time management plan:

### ⚡ **Immediate Action (Today):**
${overdueAssignments.length > 0 ? `Focus on **${overdueAssignments.length} overdue assignments**` : upcomingAssignments.length > 0 ? `Start on **"${upcomingAssignments[0]?.title}"**` : 'Review and plan ahead'}

### 📅 **This Week's Schedule:**
• **Daily Study Time**: 2-3 hours dedicated to assignments
• **Session Length**: Break large tasks into 45-minute sessions
• **Review Time**: Reserve time for revision and practice

### 🎯 **Pro Tips:**
• **Peak Hours**: Schedule demanding work during your most productive time
• **Free Periods**: Use breaks between classes effectively
• **Buffer Time**: Always reserve 20% extra time for unexpected tasks
• **Energy Management**: Match task difficulty to your energy levels`;
  }

  if (msg.includes('deadline') || msg.includes('due') || msg.includes('assignment')) {
    if (upcomingAssignments.length === 0 && overdueAssignments.length === 0) {
      return `## 🎉 No Urgent Deadlines!

Great news! You don't have any urgent assignment deadlines right now.

### 🚀 **Perfect Timing For:**
• **Get ahead** on future assignments
• **Strengthen understanding** of previous material
• **Organize study materials** and notes
• **Work on personal projects** or interests

### 💡 **Strategic Advantage:**
Use this time to build a strong foundation and reduce future stress.`;
    } else {
      return `## 📅 Your Upcoming Deadlines

Here's what you need to prepare for:

### 📝 **This Week's Assignments:**
${upcomingAssignments.slice(0, 5).map(a => `• **${a.title}** (${a.courseName})  
  📅 Due: ${new Date(a.dueDate).toLocaleDateString()}  
  ⏰ ${Math.ceil((new Date(a.dueDate) - now) / (1000 * 60 * 60 * 24))} days remaining`).join('\n\n')}

${overdueAssignments.length > 0 ? `### ⚠️ **Overdue Items:**
You have **${overdueAssignments.length} overdue assignment(s)** that need immediate attention.` : ''}`;
    }
  }

  // Study techniques and methods
  if (msg.includes('study') && (msg.includes('technique') || msg.includes('method') || msg.includes('how to study'))) {
    const subjects = [...new Set([...assignments.map(a => a.courseName), ...plannerTasks.map(t => t.subject)].filter(Boolean))];
    
    return `## 📚 Study Techniques for Your Subjects

Based on your **${subjects.length} active subjects**, here are proven study methods:

### 🧠 **Active Learning Techniques:**
• **Feynman Technique**: Explain concepts in simple terms
• **Spaced Repetition**: Review material at increasing intervals
• **Mind Mapping**: Create visual connections between topics
• **Practice Testing**: Self-quiz to reinforce learning

### 📝 **Subject-Specific Methods:**
${subjects.slice(0, 3).map(subject => `• **${subject}**: Focus on problem-solving and practical application`).join('\n')}

### ⏰ **Time Management:**
• **Pomodoro Technique**: 25-min focused sessions with 5-min breaks
• **Peak Performance**: Study challenging topics when you're most alert
• **Interleaving**: Mix different subjects in one study session

### 💡 **Pro Tips:**
• Create summary notes after each study session
• Use real-world examples to understand concepts
• Form study groups for collaborative learning
• Take regular breaks to maintain focus`;
  }

  // Machine learning specific help
  if (msg.includes('machine learning') || msg.includes('ml') || msg.includes('ai')) {
    return `## 🤖 Machine Learning Study Guide

Great choice! Machine Learning is a fascinating field. Here's your personalized study roadmap:

### 🎯 **Core Concepts to Master:**
• **Mathematics Foundation**: Linear algebra, calculus, statistics
• **Programming Skills**: Python, NumPy, Pandas, Scikit-learn
• **Algorithms**: Linear/Logistic Regression, Decision Trees, Neural Networks
• **Data Handling**: Preprocessing, feature engineering, validation

### 📚 **Recommended Learning Path:**
1. **Week 1-2**: Math fundamentals and Python basics
2. **Week 3-4**: Supervised learning algorithms
3. **Week 5-6**: Unsupervised learning and clustering
4. **Week 7-8**: Neural networks and deep learning

### 🛠️ **Practical Projects:**
• **Beginner**: House price prediction, iris classification
• **Intermediate**: Sentiment analysis, recommendation systems
• **Advanced**: Computer vision, natural language processing

### 📖 **Resources:**
• **Books**: "Hands-On Machine Learning" by Aurélien Géron
• **Courses**: Coursera ML by Andrew Ng, Fast.ai
• **Practice**: Kaggle competitions, GitHub projects

### 🎯 **Your Current Focus:**
Based on your assignments, prioritize understanding **${assignments.filter(a => a.courseName?.toLowerCase().includes('machine') || a.courseName?.toLowerCase().includes('ml')).length > 0 ? 'machine learning fundamentals' : 'programming and mathematics'}** first!`;
  }

  // Programming and coding help
  if (msg.includes('programming') || msg.includes('coding') || msg.includes('code') || msg.includes('develop')) {
    return `## 💻 Programming Study Strategy

Programming is a skill that improves with practice! Here's how to excel:

### 🎯 **Learning Approach:**
• **Start Small**: Begin with simple programs and gradually increase complexity
• **Practice Daily**: Even 30 minutes of coding daily builds skills faster
• **Build Projects**: Apply concepts to real-world problems
• **Debug Systematically**: Learn to read error messages and troubleshoot

### 🐍 **Python Focus (Most Common in ML/AI):**
• **Basics**: Variables, loops, functions, data structures
• **Libraries**: NumPy, Pandas, Matplotlib for data science
• **Object-Oriented**: Classes, inheritance, encapsulation
• **Best Practices**: Clean code, documentation, testing

### 🚀 **Project Ideas:**
• **Calculator**: Practice functions and user input
• **To-Do List**: Learn file handling and data persistence
• **Data Analyzer**: Work with CSV files and basic statistics
• **Web Scraper**: Understand HTTP requests and HTML parsing

### 💡 **Study Tips:**
• **Code Along**: Follow tutorials and type every line
• **Break Problems**: Divide complex tasks into smaller functions
• **Use Version Control**: Learn Git for project management
• **Join Communities**: Stack Overflow, Reddit r/learnprogramming

### 🎯 **Your Programming Goals:**
Focus on **${assignments.filter(a => a.title?.toLowerCase().includes('program') || a.title?.toLowerCase().includes('code')).length > 0 ? 'practical programming projects' : 'fundamental programming concepts'}** to build a strong foundation!`;
  }

  // Exam preparation
  if (msg.includes('exam') || msg.includes('test') || msg.includes('quiz') || msg.includes('prepare')) {
    const examSubjects = [...new Set([...assignments.map(a => a.courseName), ...plannerTasks.map(t => t.subject)].filter(Boolean))];
    
    return `## 📝 Exam Preparation Strategy

Preparing for exams? Here's your comprehensive study plan:

### 🎯 **Subject Prioritization:**
${examSubjects.slice(0, 3).map(subject => `• **${subject}**: Focus on key concepts and practice problems`).join('\n')}

### 📚 **Study Schedule (2 weeks before exam):**
• **Week 1**: Review all course materials and create summary notes
• **Week 2**: Practice problems, mock tests, and concept reinforcement
• **Last 3 days**: Light review and rest to avoid burnout

### 🧠 **Effective Study Methods:**
• **Active Recall**: Test yourself instead of just re-reading
• **Spaced Repetition**: Review material at optimal intervals
• **Concept Mapping**: Create visual connections between topics
• **Practice Tests**: Simulate exam conditions

### ⏰ **Daily Study Routine:**
• **Morning (2 hours)**: Focus on difficult concepts when mind is fresh
• **Afternoon (1-2 hours)**: Practice problems and applications
• **Evening (1 hour)**: Review and plan next day's study

### 💡 **Pro Tips:**
• **Start Early**: Don't cram the night before
• **Study Groups**: Explain concepts to others to reinforce learning
• **Healthy Habits**: Sleep well, eat nutritious food, exercise
• **Mindfulness**: Take breaks and manage stress

### 🎯 **Your Current Status:**
You have **${upcomingAssignments.length} upcoming assignments** - use these as practice for your exams!`;
  }

  // Stress and motivation
  if (msg.includes('stress') || msg.includes('overwhelm') || msg.includes('motivation') || msg.includes('tired')) {
    return `## 🌟 Managing Academic Stress & Finding Motivation

It's completely normal to feel overwhelmed! Here's how to get back on track:

### 😌 **Immediate Stress Relief:**
• **Take a Break**: Step away for 15-20 minutes when overwhelmed
• **Deep Breathing**: 4-7-8 breathing technique for instant calm
• **Physical Activity**: Quick walk or stretch to release tension
• **Mindfulness**: Focus on present moment, not future worries

### 🎯 **Motivation Strategies:**
• **Break Down Tasks**: Large assignments feel less overwhelming in smaller pieces
• **Celebrate Progress**: Acknowledge every small win, no matter how minor
• **Visual Goals**: Create a vision board of your academic achievements
• **Study Buddies**: Partner with classmates for mutual support

### 📅 **Realistic Planning:**
• **Daily Goals**: Set 2-3 achievable tasks per day
• **Buffer Time**: Always plan extra time for unexpected challenges
• **Flexible Schedule**: Adapt when things don't go as planned
• **Self-Care**: Prioritize sleep, nutrition, and relaxation

### 💪 **Remember:**
• **You're Capable**: You've made it this far, you can handle this
• **Progress Over Perfection**: Focus on learning, not perfect scores
• **Ask for Help**: Professors, tutors, and classmates want you to succeed
• **This is Temporary**: Academic stress has an end date

### 🎯 **Your Action Plan:**
Start with just **one small task** today. Even 15 minutes of focused work builds momentum!`;
  }

  // Time management and productivity
  if (msg.includes('time') || msg.includes('manage') || msg.includes('when should i') || msg.includes('schedule')) {
    return `## ⏰ Advanced Time Management Strategy

Based on your current workload, here's your personalized time optimization plan:

### ⚡ **Immediate Action (Today):**
${overdueAssignments.length > 0 ? `Focus on **${overdueAssignments.length} overdue assignments**` : upcomingAssignments.length > 0 ? `Start on **"${upcomingAssignments[0]?.title}"**` : 'Review and plan ahead'}

### 📅 **This Week's Schedule:**
• **Daily Study Time**: 2-3 hours dedicated to assignments
• **Session Length**: Break large tasks into 45-minute sessions
• **Review Time**: Reserve time for revision and practice
• **Buffer Time**: Always reserve 20% extra time for unexpected tasks

### 🎯 **Pro Tips:**
• **Peak Hours**: Schedule demanding work during your most productive time
• **Free Periods**: Use breaks between classes effectively
• **Energy Management**: Match task difficulty to your energy levels
• **Batch Similar Tasks**: Group similar activities to reduce context switching

### 📊 **Your Time Analysis:**
• **Total Tasks**: ${assignments.length + plannerTasks.length}
• **Urgent Items**: ${overdueAssignments.length + upcomingAssignments.filter(a => {
  const dueDate = new Date(a.dueDate);
  const daysDiff = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
  return daysDiff <= 3;
}).length}
• **Recommended Daily Study**: ${Math.ceil((assignments.length + plannerTasks.length) * 0.5)} hours

### 🚀 **Productivity Boosters:**
• **Eliminate Distractions**: Use apps like Forest or Focus@Will
• **Pomodoro Technique**: 25-min work + 5-min break cycles
• **Two-Minute Rule**: If it takes less than 2 minutes, do it now
• **Weekly Review**: Reflect on what worked and adjust accordingly`;
  }

  // Help and capabilities
  if (msg.includes('help') || msg.includes('what can you do') || msg.includes('capabilities')) {
    return `## 🤖 AI Study Assistant - Your Complete Academic Companion

Hi ${user.name}! I'm your personalized AI study companion with advanced capabilities:

### 📋 **Task Management & Prioritization:**
• **Smart Prioritization**: AI-powered task ranking based on deadlines, importance, and complexity
• **Deadline Analysis**: Track upcoming assignments and create action plans
• **Workload Balancing**: Distribute tasks across available time slots
• **Progress Tracking**: Monitor completion rates and identify bottlenecks

### 📚 **Study Planning & Learning:**
• **Personalized Study Plans**: Custom roadmaps for each subject and learning goal
• **Learning Paths**: Step-by-step guidance from basics to advanced concepts
• **Resource Recommendations**: Curated materials, books, and online courses
• **Study Technique Selection**: Choose methods based on subject and learning style

### ⏰ **Time Management & Productivity:**
• **Schedule Optimization**: Find optimal study times based on your timetable
• **Productivity Analysis**: Identify your peak performance hours
• **Break Planning**: Strategic rest periods for maximum retention
• **Goal Setting**: SMART goal framework for academic success

### 🧠 **Subject-Specific Support:**
• **Machine Learning**: Algorithms, mathematics, practical projects
• **Programming**: Code structure, debugging, best practices
• **Mathematics**: Problem-solving strategies, concept connections
• **Engineering**: Design principles, practical applications

### 💡 **Smart Insights & Analytics:**
I analyze your:
- Google Classroom assignments and submission status
- Planner tasks with priority and estimated time
- Academic schedule and available free time
- Study patterns and performance trends
- Learning preferences and strengths

### 🚀 **Advanced Features:**
• **Context Awareness**: Responses based on your actual coursework
• **Adaptive Learning**: Adjusts recommendations based on your progress
• **Stress Management**: Coping strategies for academic pressure
• **Motivation Support**: Encouragement and accountability

### 🎯 **Get Started:**
Just ask me anything! Try these examples:
• "How should I study machine learning?"
• "Create a study plan for my programming course"
• "Help me manage exam stress"
• "What's the best way to learn Python?"
• "How can I improve my time management?"`;
  }

  // Subject-specific learning guidance
  if (msg.includes('math') || msg.includes('mathematics') || msg.includes('calculus') || msg.includes('algebra')) {
    return `## 📐 Mathematics Learning Strategy

Mathematics is the foundation of many subjects! Here's your personalized approach:

### 🎯 **Core Learning Principles:**
• **Understand, Don't Memorize**: Focus on concepts, not just formulas
• **Practice Regularly**: Daily problem-solving builds confidence
• **Connect Concepts**: See how different topics relate to each other
• **Real Applications**: Apply math to solve practical problems

### 📚 **Study Techniques:**
• **Problem-Solving Framework**: Read → Plan → Execute → Check
• **Concept Mapping**: Create visual connections between topics
• **Practice Tests**: Regular self-assessment to identify weak areas
• **Study Groups**: Explain concepts to others to reinforce learning

### 🧮 **Subject Focus Areas:**
• **Calculus**: Limits, derivatives, integrals, applications
• **Linear Algebra**: Vectors, matrices, transformations, eigenvalues
• **Statistics**: Probability, distributions, hypothesis testing
• **Discrete Math**: Logic, sets, combinatorics, algorithms

### 💡 **Pro Tips:**
• **Start with Basics**: Ensure fundamental concepts are solid
• **Use Multiple Resources**: Textbooks, online videos, practice problems
• **Track Progress**: Keep a log of problems you've solved
• **Celebrate Small Wins**: Every solved problem is progress!

### 🎯 **Your Math Goals:**
Focus on **${assignments.filter(a => a.title?.toLowerCase().includes('math') || a.title?.toLowerCase().includes('calculus')).length > 0 ? 'practical applications and problem-solving' : 'building strong mathematical foundations'}**`;
  }

  // Project and assignment help
  if (msg.includes('project') || msg.includes('assignment') || msg.includes('homework') || msg.includes('lab')) {
    const projectAssignments = assignments.filter(a => a.title?.toLowerCase().includes('project') || a.title?.toLowerCase().includes('lab') || a.title?.toLowerCase().includes('assignment'));
    
    return `## 📋 Project & Assignment Management

You have **${projectAssignments.length} active projects/assignments**. Here's how to tackle them effectively:

### 🎯 **Project Planning Framework:**
• **Break Down**: Divide large projects into smaller, manageable tasks
• **Timeline Creation**: Set realistic deadlines for each component
• **Resource Gathering**: Collect all necessary materials and references
• **Progress Tracking**: Monitor completion of each milestone

### 📅 **Assignment Workflow:**
1. **Understanding Phase**: Read requirements thoroughly, ask questions
2. **Planning Phase**: Create outline, gather resources, set timeline
3. **Execution Phase**: Work systematically through each component
4. **Review Phase**: Check quality, meet requirements, submit on time

### 🛠️ **Tools & Techniques:**
• **Project Management**: Use Trello, Notion, or simple checklists
• **Time Blocking**: Dedicate specific time slots to each project
• **Pomodoro Technique**: 25-min focused work sessions
• **Regular Breaks**: Maintain energy and focus throughout

### 💡 **Success Strategies:**
• **Start Early**: Avoid last-minute stress and rushed work
• **Regular Check-ins**: Review progress daily or weekly
• **Ask for Help**: Reach out to professors or classmates early
• **Quality Over Speed**: Focus on learning, not just completing

### 🎯 **Your Current Projects:**
${projectAssignments.slice(0, 3).map(a => `• **${a.title}** (${a.courseName}) - Due: ${new Date(a.dueDate).toLocaleDateString()}`).join('\n')}

**Which project would you like to focus on first?**`;
  }

  // Learning resources and materials
  if (msg.includes('resource') || msg.includes('book') || msg.includes('video') || msg.includes('course') || msg.includes('material')) {
    return `## 📚 Learning Resources & Materials

Here's a curated list of high-quality resources for your studies:

### 🎓 **Online Learning Platforms:**
• **Coursera**: University-level courses with certificates
• **edX**: Free courses from top institutions
• **Udemy**: Practical, project-based learning
• **Khan Academy**: Free foundational concepts
• **YouTube**: Educational channels and tutorials

### 📖 **Recommended Books by Subject:**
• **Machine Learning**: "Hands-On ML" by Aurélien Géron, "Pattern Recognition" by Bishop
• **Programming**: "Python Crash Course" by Matthes, "Clean Code" by Martin
• **Mathematics**: "Calculus" by Stewart, "Linear Algebra" by Strang
• **Computer Science**: "Introduction to Algorithms" by CLRS

### 🎯 **Study Material Types:**
• **Textbooks**: Comprehensive coverage of topics
• **Video Lectures**: Visual learning and demonstrations
• **Practice Problems**: Application and reinforcement
• **Research Papers**: Advanced concepts and current trends
• **Online Forums**: Community support and discussions

### 💡 **Resource Selection Tips:**
• **Match Your Level**: Choose materials appropriate for your current understanding
• **Multiple Formats**: Combine reading, watching, and practicing
• **Active Learning**: Engage with materials, don't just consume
• **Regular Updates**: Stay current with latest developments in your field

### 🎯 **Your Learning Path:**
Based on your current courses, focus on **${assignments.length > 0 ? 'practical, hands-on resources' : 'comprehensive foundational materials'}** to build strong knowledge!`;
  }

  // Career and future planning
  if (msg.includes('career') || msg.includes('job') || msg.includes('future') || msg.includes('industry') || msg.includes('work')) {
    return `## 🚀 Career Planning & Industry Insights

Great thinking about your future! Here's how to align your studies with career goals:

### 🎯 **Industry Trends & Opportunities:**
• **Technology**: AI/ML, software development, data science
• **Healthcare**: Medical technology, bioinformatics, health informatics
• **Finance**: Fintech, quantitative analysis, risk management
• **Education**: EdTech, online learning platforms, educational software
• **Environment**: Green technology, sustainability, renewable energy

### 📚 **Academic Preparation:**
• **Core Skills**: Strong foundation in mathematics and programming
• **Specialization**: Choose electives aligned with your interests
• **Projects**: Build portfolio of practical work and research
• **Networking**: Connect with professionals and alumni
• **Internships**: Gain real-world experience early

### 🛠️ **Skill Development:**
• **Technical Skills**: Programming languages, tools, frameworks
• **Soft Skills**: Communication, teamwork, problem-solving
• **Industry Knowledge**: Stay updated with trends and developments
• **Professional Development**: Attend conferences, workshops, meetups

### 💡 **Career Planning Steps:**
1. **Self-Assessment**: Identify your interests, strengths, and values
2. **Research**: Explore different career paths and requirements
3. **Skill Building**: Develop necessary technical and soft skills
4. **Networking**: Connect with professionals in your target field
5. **Experience**: Gain practical experience through projects and internships

### 🎯 **Your Academic Advantage:**
With **${assignments.length} active courses** and **${plannerTasks.length} planned projects**, you're building a strong foundation for your future career!

**What specific career path interests you most?**`;
  }

  // Default contextual response with better formatting
  const responses = [
    `## 👋 Hello ${user.name}!

I can see you have **${assignments.length} active assignments** and **${plannerTasks.length} planner tasks**.

### 🎯 **How Can I Help?**
• Prioritize your workload
• Create study schedules
• Manage your time effectively
• Plan your assignments

**What would you like to focus on today?**`,

    `## 📊 Workload Analysis

Based on your current data, you're managing **${assignments.length + plannerTasks.length} total tasks**.

### 🔍 **What Specific Area Do You Need Help With?**
• **Prioritization** - What to work on first
• **Time Management** - When to study what
• **Study Planning** - How to organize your work

**Let me know what you'd like to tackle!**`,

    `## 📈 Weekly Overview

I've analyzed your Google Classroom and planner data:
• **${upcomingAssignments.length} assignments** due this week
• **${plannerTasks.length} planner tasks** to complete

### 🎯 **Would You Like Me To:**
• Create a priority list?
• Design a study schedule?
• Help with time management?

**Just tell me what you need!**`,

    `## 🚀 Study Optimization

I can help you optimize your study schedule! With **${assignments.length} assignments** across multiple courses, effective planning is key.

### 💡 **I Can Help You:**
• Organize your workload
• Create efficient study routines
• Balance multiple subjects
• Meet all your deadlines

**What would you like to focus on first?**`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

module.exports = router; 