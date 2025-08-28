import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';

// Components
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import Timetable from './components/Timetable/Timetable';
import EditableTimetable from './components/Timetable/EditableTimetable';
import Assignments from './components/Assignments/Assignments';
import AIAssistant from './components/AI/AIAssistant';
import Profile from './components/Profile/Profile';
import StudyTimer from './components/StudyTools/StudyTimer';
import Planner from './components/StudyTools/Planner';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Styles
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <div className="App">
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
            
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="timetable" element={<Timetable />} />
                <Route path="timetable/edit" element={<EditableTimetable />} />
                <Route path="assignments" element={<Assignments />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="study-timer" element={<StudyTimer />} />
                <Route path="planner" element={<Planner />} />
                <Route path="profile" element={<Profile />} />
              </Route>
              
              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App; 