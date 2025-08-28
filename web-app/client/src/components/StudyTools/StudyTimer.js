import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Coffee, 
  Target,
  Settings,
  Zap,
  Volume2,
  VolumeX
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const StudyTimer = () => {
  const [mode, setMode] = useState('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [totalStudyTime, setTotalStudyTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoStartBreaks, setAutoStartBreaks] = useState(false);
  const [currentTask, setCurrentTask] = useState('');
  const [notificationPermission, setNotificationPermission] = useState('default');
  
  // Timer settings
  const [settings, setSettings] = useState({
    focusTime: 25,
    shortBreakTime: 5,
    longBreakTime: 15,
    sessionsUntilLongBreak: 4
  });

  // Timer state refs for accurate timing
  const startTimeRef = useRef(null);
  const pauseTimeRef = useRef(0);
  const intervalRef = useRef(null);
  const lastUpdateTimeRef = useRef(Date.now());
  
  // Audio context for alarm sounds
  const audioContextRef = useRef(null);
  const alarmIntervalRef = useRef(null);
  
  // Broadcast channel for cross-tab communication
  const broadcastChannel = useRef(null);
  
  // Initialize broadcast channel and notification permission
  useEffect(() => {
    try {
      broadcastChannel.current = new BroadcastChannel('studyTimer');
      
      // Listen for messages from other tabs
      broadcastChannel.current.onmessage = (event) => {
        const { type, data } = event.data;
        
        switch (type) {
          case 'TIMER_START':
            handleRemoteTimerStart(data);
            break;
          case 'TIMER_PAUSE':
            handleRemoteTimerPause(data);
            break;
          case 'TIMER_STOP':
            handleRemoteTimerStop(data);
            break;
          case 'MODE_CHANGE':
            handleRemoteModeChange(data);
            break;
        }
      };
      
      return () => {
        if (broadcastChannel.current) {
          broadcastChannel.current.close();
        }
      };
    } catch (error) {
      console.log('BroadcastChannel not supported, using localStorage fallback');
    }
    
    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Initialize audio context
  useEffect(() => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.log('Web Audio API not supported');
    }
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Load saved timer settings on mount
  useEffect(() => {
    loadSavedSettings();
  }, []);

  // Restore timer state from localStorage on mount
  useEffect(() => {
    restoreTimerState();
  }, []);

  // Save timer state to localStorage whenever it changes
  useEffect(() => {
    if (isActive || isPaused) {
      saveTimerState();
    }
  }, [isActive, isPaused, mode, timeLeft]);

  // Load saved timer settings from localStorage
  const loadSavedSettings = useCallback(() => {
    try {
      const savedSettings = localStorage.getItem('studyTimerSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
        console.log('Timer settings loaded from localStorage:', parsedSettings);
      }
    } catch (error) {
      console.error('Error loading timer settings:', error);
    }
  }, []);

  // Save timer settings to localStorage
  const saveTimerSettings = useCallback(() => {
    try {
      localStorage.setItem('studyTimerSettings', JSON.stringify(settings));
      toast.success('Timer settings saved successfully! 🎉', { duration: 3000 });
      console.log('Timer settings saved to localStorage:', settings);
    } catch (error) {
      console.error('Error saving timer settings:', error);
      toast.error('Failed to save settings. Please try again.', { duration: 3000 });
    }
  }, [settings]);

  // Reset timer settings to defaults
  const resetTimerSettings = useCallback(() => {
    const defaultSettings = {
      focusTime: 25,
      shortBreakTime: 5,
      longBreakTime: 15,
      sessionsUntilLongBreak: 4
    };
    
    setSettings(defaultSettings);
    toast.success('Timer settings reset to defaults! 🔄', { duration: 3000 });
    console.log('Timer settings reset to defaults:', defaultSettings);
  }, []);

  // Main timer logic
  useEffect(() => {
    if (isActive && !isPaused) {
      // Start the timer
      startTimeRef.current = startTimeRef.current || Date.now();
      
      const updateTimer = () => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current) / 1000);
        const totalTime = getTotalTimeForMode(mode);
        const remaining = Math.max(0, totalTime - elapsed);
        
        setTimeLeft(remaining);
        lastUpdateTimeRef.current = now;
        
        // Check if timer completed
        if (remaining <= 0) {
          handleTimerComplete();
          return;
        }
      };
      
      // Update immediately
      updateTimer();
      
      // Set interval for updates
      intervalRef.current = setInterval(updateTimer, 1000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // Clear interval when timer is not active
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isActive, isPaused, mode]);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - timer continues running in background
        // Just save the current state
        saveTimerState();
      } else {
        // Tab is visible again - sync the timer immediately
        if (isActive && !isPaused && startTimeRef.current) {
          const now = Date.now();
          const elapsed = Math.floor((now - startTimeRef.current) / 1000);
          const totalTime = getTotalTimeForMode(mode);
          const remaining = Math.max(0, totalTime - elapsed);
          
          setTimeLeft(remaining);
          
          // Check if timer should have completed while tab was hidden
          if (remaining <= 0) {
            handleTimerComplete();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, isPaused, mode]);

  // Helper function to get total time for current mode
  const getTotalTimeForMode = useCallback((currentMode) => {
    switch (currentMode) {
      case 'focus':
        return settings.focusTime * 60;
      case 'shortBreak':
        return settings.shortBreakTime * 60;
      case 'longBreak':
        return settings.longBreakTime * 60;
      default:
        return settings.focusTime * 60;
    }
  }, [settings]);

  // Save timer state to localStorage
  const saveTimerState = useCallback(() => {
    const timerState = {
      isActive,
      isPaused,
      mode,
      timeLeft,
      startTime: startTimeRef.current,
      pauseTime: pauseTimeRef.current,
      timestamp: Date.now()
    };
    
    localStorage.setItem('studyTimerState', JSON.stringify(timerState));
    
    // Also save to sessionStorage for immediate tab switching
    sessionStorage.setItem('studyTimerState', JSON.stringify(timerState));
  }, [isActive, isPaused, mode, timeLeft]);

  // Restore timer state from localStorage
  const restoreTimerState = useCallback(() => {
    try {
      // Try sessionStorage first (for immediate tab switching)
      let savedState = sessionStorage.getItem('studyTimerState') || 
                       localStorage.getItem('studyTimerState');
      
      if (savedState) {
        const state = JSON.parse(savedState);
        const now = Date.now();
        const timeSinceSaved = now - state.timestamp;
        
        // Only restore if the saved state is recent (within 1 hour)
        if (timeSinceSaved < 3600000 && state.isActive) {
          // Calculate remaining time based on actual elapsed time
          let remaining = state.timeLeft;
          
          if (!state.isPaused && state.startTime) {
            const elapsedSinceSaved = Math.floor(timeSinceSaved / 1000);
            const totalTime = getTotalTimeForMode(state.mode);
            remaining = Math.max(0, totalTime - elapsedSinceSaved);
          }
          
          if (remaining > 0) {
            // Restore the timer state
            setMode(state.mode);
            setTimeLeft(remaining);
            setIsActive(true);
            setIsPaused(state.isPaused);
            startTimeRef.current = state.startTime;
            pauseTimeRef.current = state.pauseTime;
            
            console.log('Timer restored:', { 
              mode: state.mode, 
              remaining, 
              isPaused: state.isPaused 
            });
          } else {
            // Timer would have completed, clear saved state
            clearSavedState();
          }
        } else {
          // Clear old saved state
          clearSavedState();
        }
      }
    } catch (error) {
      console.error('Error restoring timer state:', error);
      clearSavedState();
    }
  }, [getTotalTimeForMode]);

  // Clear saved timer state
  const clearSavedState = useCallback(() => {
    localStorage.removeItem('studyTimerState');
    sessionStorage.removeItem('studyTimerState');
  }, []);

  // Broadcast timer state to other tabs
  const broadcastTimerState = useCallback((type, data) => {
    if (broadcastChannel.current) {
      try {
        broadcastChannel.current.postMessage({ type, data });
      } catch (error) {
        console.log('Broadcast failed, using localStorage fallback');
      }
    }
  }, []);

  // Handle remote timer start
  const handleRemoteTimerStart = useCallback((data) => {
    if (data.timestamp > lastUpdateTimeRef.current) {
      setMode(data.mode);
      setTimeLeft(data.timeLeft);
      setIsActive(true);
      setIsPaused(false);
      startTimeRef.current = data.startTime;
      pauseTimeRef.current = 0;
    }
  }, []);

  // Handle remote timer pause
  const handleRemoteTimerPause = useCallback((data) => {
    if (data.timestamp > lastUpdateTimeRef.current) {
      setIsPaused(true);
      pauseTimeRef.current = data.pauseTime;
    }
  }, []);

  // Handle remote timer stop
  const handleRemoteTimerStop = useCallback((data) => {
    if (data.timestamp > lastUpdateTimeRef.current) {
      setIsActive(false);
      setIsPaused(false);
      startTimeRef.current = null;
      pauseTimeRef.current = 0;
      setTimeLeft(getTotalTimeForMode(data.mode));
    }
  }, [getTotalTimeForMode]);

  // Handle remote mode change
  const handleRemoteModeChange = useCallback((data) => {
    if (data.timestamp > lastUpdateTimeRef.current) {
      setMode(data.mode);
      setTimeLeft(getTotalTimeForMode(data.mode));
      setIsActive(false);
      setIsPaused(false);
      startTimeRef.current = null;
      pauseTimeRef.current = 0;
    }
  }, [getTotalTimeForMode]);

  // Enhanced alarm sound system
  const playAlarmSound = useCallback(async () => {
    if (!soundEnabled || !audioContextRef.current) return;
    
    try {
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Create a more noticeable alarm sound
      const playBeep = () => {
        const oscillator = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContextRef.current.currentTime);
        gain.gain.setValueAtTime(0.001, audioContextRef.current.currentTime);
        
        oscillator.connect(gain);
        gain.connect(audioContextRef.current.destination);
        
        oscillator.start();
        gain.gain.exponentialRampToValueAtTime(0.3, audioContextRef.current.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContextRef.current.currentTime + 0.5);
        oscillator.stop(audioContextRef.current.currentTime + 0.5);
      };
      
      // Play multiple beeps for alarm effect
      playBeep();
      setTimeout(() => playBeep(), 600);
      setTimeout(() => playBeep(), 1200);
      
    } catch (error) {
      console.log('Audio playback failed:', error);
    }
  }, [soundEnabled]);

  // Stop alarm sound
  const stopAlarmSound = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        return permission;
      } catch (error) {
        console.log('Notification permission request failed:', error);
        return 'denied';
      }
    }
    return Notification.permission;
  }, []);

  // Show browser notification
  const showNotification = useCallback((title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico', // You can replace this with your app icon
          badge: '/favicon.ico',
          tag: 'studyTimer',
          requireInteraction: true, // Keep notification until user interacts
          silent: false // Allow system sounds
        });
        
        // Auto-close after 10 seconds
        setTimeout(() => {
          notification.close();
        }, 10000);
        
        // Focus the window when notification is clicked
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        
      } catch (error) {
        console.log('Notification failed:', error);
      }
    }
  }, []);

  // Handle timer completion with enhanced notifications
  const handleTimerComplete = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    startTimeRef.current = null;
    pauseTimeRef.current = 0;
    
    // Clear saved timer state
    clearSavedState();
    
    // Play alarm sound
    playAlarmSound();
    
    // Show browser notification
    const modeText = mode === 'focus' ? 'Focus Session' : 
                     mode === 'shortBreak' ? 'Short Break' : 'Long Break';
    showNotification(
      `⏰ ${modeText} Complete!`,
      mode === 'focus' ? 'Great job! Time for a break.' : 'Break time is over. Ready to focus?'
    );
    
    // Show toast notification
    if (mode === 'focus') {
      setSessions(prev => prev + 1);
      setTotalStudyTime(prev => prev + settings.focusTime);
      
      // Determine next break type
      const nextSessions = sessions + 1;
      const isLongBreak = nextSessions % settings.sessionsUntilLongBreak === 0;
      const nextMode = isLongBreak ? 'longBreak' : 'shortBreak';
      const nextTime = isLongBreak ? settings.longBreakTime : settings.shortBreakTime;
      
      setMode(nextMode);
      setTimeLeft(nextTime * 60);
      
      toast.success(
        `🎉 Focus session complete! Time for a ${isLongBreak ? 'long' : 'short'} break.`,
        { duration: 5000 }
      );

      if (autoStartBreaks) {
        setTimeout(() => {
          startTimer();
        }, 3000);
      }
    } else if (mode === 'shortBreak' || mode === 'longBreak') {
      // Break completed - switch to focus mode but DON'T auto-start
      setMode('focus');
      setTimeLeft(settings.focusTime * 60);
      
      toast.success('Break time over! Ready to focus again?', { duration: 5000 });
    }
  }, [mode, sessions, settings, playAlarmSound, showNotification, clearSavedState, autoStartBreaks]);

  // Start timer
  const startTimer = useCallback(() => {
    if (!isActive) {
      setIsActive(true);
      setIsPaused(false);
      startTimeRef.current = Date.now();
      pauseTimeRef.current = 0;
      
      // Broadcast to other tabs
      broadcastTimerState('TIMER_START', {
        mode,
        timeLeft,
        startTime: startTimeRef.current,
        timestamp: Date.now()
      });
    }
  }, [isActive, mode, timeLeft, broadcastTimerState]);

  // Pause timer
  const pauseTimer = useCallback(() => {
    if (isActive && !isPaused) {
      setIsPaused(true);
      pauseTimeRef.current = Date.now() - startTimeRef.current;
      
      // Broadcast to other tabs
      broadcastTimerState('TIMER_PAUSE', {
        pauseTime: pauseTimeRef.current,
        timestamp: Date.now()
      });
    }
  }, [isActive, isPaused, broadcastTimerState]);

  // Resume timer
  const resumeTimer = useCallback(() => {
    if (isActive && isPaused) {
      setIsPaused(false);
      startTimeRef.current = Date.now() - pauseTimeRef.current;
      pauseTimeRef.current = 0;
      
      // Broadcast to other tabs
      broadcastTimerState('TIMER_START', {
        mode,
        timeLeft,
        startTime: startTimeRef.current,
        timestamp: Date.now()
      });
    }
  }, [isActive, isPaused, mode, timeLeft, broadcastTimerState]);

  // Toggle timer (start/pause/resume)
  const toggleTimer = useCallback(() => {
    if (!isActive) {
      startTimer();
    } else if (isPaused) {
      resumeTimer();
    } else {
      pauseTimer();
    }
  }, [isActive, isPaused, startTimer, pauseTimer, resumeTimer]);

  // Reset timer
  const resetTimer = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    startTimeRef.current = null;
    pauseTimeRef.current = 0;
    
    // Clear saved timer state
    clearSavedState();
    
    // Reset to current mode's default time
    const time = getTotalTimeForMode(mode);
    setTimeLeft(time);
    
    // Broadcast to other tabs
    broadcastTimerState('TIMER_STOP', {
      mode,
      timeLeft: time,
      timestamp: Date.now()
    });
  }, [mode, getTotalTimeForMode, clearSavedState, broadcastTimerState]);

  // Switch timer mode
  const switchMode = useCallback((newMode) => {
    // Stop current timer if running
    if (isActive) {
      setIsActive(false);
      setIsPaused(false);
      startTimeRef.current = null;
      pauseTimeRef.current = 0;
    }
    
    setMode(newMode);
    setIsActive(false);
    setIsPaused(false);
    
    // Clear saved timer state
    clearSavedState();
    
    // Set time for new mode
    const time = getTotalTimeForMode(newMode);
    setTimeLeft(time);
    
    // Broadcast to other tabs
    broadcastTimerState('MODE_CHANGE', {
      mode: newMode,
      timeLeft: time,
      timestamp: Date.now()
    });
  }, [isActive, getTotalTimeForMode, clearSavedState, broadcastTimerState]);

  // Format time display
  const formatTime = useCallback((seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Calculate progress percentage
  const getProgress = useCallback(() => {
    const totalTime = getTotalTimeForMode(mode);
    return ((totalTime - timeLeft) / totalTime) * 100;
  }, [mode, timeLeft, getTotalTimeForMode]);

  // Get mode configuration
  const getModeConfig = useCallback(() => {
    switch (mode) {
      case 'focus':
        return {
          title: 'Focus Time',
          icon: Target,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          buttonColor: 'bg-red-600 hover:bg-red-700'
        };
      case 'shortBreak':
        return {
          title: 'Short Break',
          icon: Coffee,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          buttonColor: 'bg-green-600 hover:bg-green-700'
        };
      case 'longBreak':
        return {
          title: 'Long Break',
          icon: Coffee,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          buttonColor: 'bg-blue-600 hover:bg-blue-700'
        };
      default:
        return {};
    }
  }, [mode]);

  const config = getModeConfig();
  const Icon = config.icon;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Study Timer</h1>
        <p className="text-gray-600">Stay focused with the Pomodoro Technique</p>
      </div>

      {/* Mode Selector */}
      <div className="flex justify-center space-x-2">
        {[
          { key: 'focus', label: 'Focus', icon: Target },
          { key: 'shortBreak', label: 'Short Break', icon: Coffee },
          { key: 'longBreak', label: 'Long Break', icon: Coffee }
        ].map(({ key, label, icon: ModeIcon }) => (
          <button
            key={key}
            onClick={() => switchMode(key)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              mode === key 
                ? 'bg-primary text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ModeIcon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Timer Display */}
      <div className={`relative mx-auto w-80 h-80 ${config.bgColor} ${config.borderColor} border-4 rounded-full flex items-center justify-center`}>
        {/* Progress Ring */}
        <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-200"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={config.color}
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - getProgress() / 100)}`}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>

        {/* Timer Content */}
        <div className="text-center z-10">
          <Icon className={`w-8 h-8 mx-auto mb-2 ${config.color}`} />
          <div className="text-4xl font-mono font-bold text-gray-900 mb-2">
            {formatTime(timeLeft)}
          </div>
          <div className={`text-sm font-medium ${config.color}`}>
            {config.title}
          </div>
          {currentTask && (
            <div className="text-xs text-gray-600 mt-2 max-w-32 truncate">
              {currentTask}
            </div>
          )}
        </div>
      </div>

      {/* Current Task Input */}
      <div className="text-center">
        <input
          type="text"
          placeholder="What are you working on?"
          value={currentTask}
          onChange={(e) => setCurrentTask(e.target.value)}
          className="input text-center max-w-xs mx-auto"
        />
        
        {/* Timer Status Display */}
        <div className="mt-4 text-sm text-gray-600">
          <div>Status: {isActive ? (isPaused ? '⏸️ Paused' : '▶️ Running') : '⏹️ Stopped'}</div>
          <div>Mode: {mode === 'focus' ? '🍅 Focus' : mode === 'shortBreak' ? '☕ Short Break' : '☕ Long Break'}</div>
          <div>Time Left: {formatTime(timeLeft)}</div>
          {isActive && !isPaused && (
            <div className="text-xs text-green-600 mt-1">
              💡 Timer runs in background when switching tabs
            </div>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center space-x-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTimer}
          className={`px-8 py-3 text-white font-medium rounded-lg flex items-center gap-2 ${config.buttonColor}`}
        >
          {isActive && !isPaused ? (
            <>
              <Pause className="w-5 h-5" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Start
            </>
          )}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={resetTimer}
          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg flex items-center gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          Reset
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">{sessions}</div>
          <div className="text-sm text-gray-600">Sessions</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">{Math.floor(totalStudyTime / 60)}h {totalStudyTime % 60}m</div>
          <div className="text-sm text-gray-600">Study Time</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">{sessions % settings.sessionsUntilLongBreak}/{settings.sessionsUntilLongBreak}</div>
          <div className="text-sm text-gray-600">Until Long Break</div>
        </div>
      </div>

      {/* Settings */}
      <div className="text-center">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="btn btn-outline flex items-center gap-2 mx-auto"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>

      {showSettings && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg p-6 shadow-lg border space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">Timer Settings</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Focus Time (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.focusTime}
                onChange={(e) => setSettings(prev => ({ ...prev, focusTime: parseInt(e.target.value) || 25 }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Short Break (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.shortBreakTime}
                onChange={(e) => setSettings(prev => ({ ...prev, shortBreakTime: parseInt(e.target.value) || 5 }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Long Break (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.longBreakTime}
                onChange={(e) => setSettings(prev => ({ ...prev, longBreakTime: parseInt(e.target.value) || 15 }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sessions Until Long Break
              </label>
              <input
                type="number"
                min="2"
                max="10"
                value={settings.sessionsUntilLongBreak}
                onChange={(e) => setSettings(prev => ({ ...prev, sessionsUntilLongBreak: parseInt(e.target.value) || 4 }))}
                className="input"
              />
            </div>
          </div>

          {/* Settings Action Buttons */}
          <div className="flex justify-center space-x-3 pt-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={saveTimerSettings}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center gap-2"
            >
              💾 Save Settings
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetTimerSettings}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg flex items-center gap-2"
            >
              🔄 Reset to Defaults
            </motion.button>
          </div>

          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Enable notification sounds</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoStartBreaks}
                onChange={(e) => setAutoStartBreaks(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Auto-start breaks</span>
            </label>
          </div>

          {/* Notification Permission Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Browser Notifications</h4>
                <p className="text-xs text-gray-500">
                  Get notified when timer completes, even when using other apps
                </p>
              </div>
              <div className="flex items-center gap-2">
                {notificationPermission === 'granted' ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <Volume2 className="w-4 h-4" />
                    <span className="text-xs">Enabled</span>
                  </div>
                ) : notificationPermission === 'denied' ? (
                  <div className="flex items-center gap-1 text-red-600">
                    <VolumeX className="w-4 h-4" />
                    <span className="text-xs">Blocked</span>
                  </div>
                ) : (
                  <button
                    onClick={requestNotificationPermission}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Enable
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Pomodoro Tips
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Focus completely during work sessions</li>
          <li>• Take breaks seriously - step away from your desk</li>
          <li>• Use breaks for light activities like stretching</li>
          <li>• Track what you accomplish in each session</li>
        </ul>
      </div>
    </div>
  );
};

export default StudyTimer;
