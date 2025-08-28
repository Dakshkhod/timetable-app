import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  BookOpen, 
  Brain, 
  User, 
  Menu, 
  X, 
  Bell,
  Settings,
  LogOut,
  Timer,
  Target,
  Home
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home, current: location.pathname === '/' },
    { 
      name: 'Timetable', 
      href: '/timetable', 
      icon: Calendar, 
      current: location.pathname === '/timetable' || location.pathname === '/timetable/edit',
      submenu: [
        { name: 'View Timetable', href: '/timetable', current: location.pathname === '/timetable' },
        { name: 'Edit Timetable', href: '/timetable/edit', current: location.pathname === '/timetable/edit' }
      ]
    },
    { name: 'Assignments', href: '/assignments', icon: BookOpen, current: location.pathname === '/assignments' },
    { name: 'Study Timer', href: '/study-timer', icon: Timer, current: location.pathname === '/study-timer' },
    { name: 'Planner', href: '/planner', icon: Target, current: location.pathname === '/planner' },
    { name: 'AI Assistant', href: '/ai-assistant', icon: Brain, current: location.pathname === '/ai-assistant' },
    { name: 'Profile', href: '/profile', icon: User, current: location.pathname === '/profile' },
  ];

  const handleNavigation = (href) => {
    navigate(href);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-large transform transition-transform duration-300 ease-in-out lg:fixed lg:inset-y-0 lg:left-0 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-secondary-200">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold gradient-text">SmartTimetable</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md text-secondary-400 hover:text-secondary-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-4 py-6">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.name}>
                  <button
                    onClick={() => handleNavigation(item.href)}
                    className={`w-full flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      item.current
                        ? 'sidebar-item-active'
                        : 'sidebar-item'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </button>
                  
                  {/* Submenu for Timetable */}
                  {item.submenu && item.current && (
                    <div className="ml-8 mt-2 space-y-1">
                      {item.submenu.map((subItem) => (
                        <button
                          key={subItem.name}
                          onClick={() => handleNavigation(subItem.href)}
                          className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                            subItem.current
                              ? 'bg-primary-100 text-primary-700'
                              : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100'
                          }`}
                        >
                          {subItem.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User info */}
          <div className="border-t border-secondary-200 p-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-700">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-900 truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-secondary-500 truncate">
                  {user?.branch} • Year {user?.year}
                </p>
              </div>
            </div>
            
            {/* Logout button in sidebar */}
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to logout?')) {
                  logout();
                }
              }}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="bg-white shadow-soft border-b border-secondary-200">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Page title */}
            <div className="flex-1 lg:ml-6">
              <h1 className="text-2xl font-bold text-secondary-900">
                {navigation.find(item => item.current)?.name || 'Dashboard'}
              </h1>
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="p-2 rounded-md text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100">
                <Bell className="h-6 w-6" />
              </button>

              {/* Settings */}
              <button className="p-2 rounded-md text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100">
                <Settings className="h-6 w-6" />
              </button>

              {/* Logout */}
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to logout?')) {
                    logout();
                  }
                }}
                className="p-2 rounded-md text-secondary-400 hover:text-danger-600 hover:bg-danger-50 transition-colors duration-200"
                title="Logout"
              >
                <LogOut className="h-6 w-6" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="py-3 overflow-x-hidden">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout; 