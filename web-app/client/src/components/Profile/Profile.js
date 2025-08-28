import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { 
  User, 
  Mail, 
  GraduationCap, 
  Building, 
  Hash, 
  Lock, 
  Eye, 
  EyeOff, 
  Save,
  Settings,
  Bell,
  Palette,
  Globe,
  LogOut
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const { user, updateProfile, changePassword, logout } = useAuth();

  const { register: registerProfile, handleSubmit: handleProfileSubmit, formState: { errors: profileErrors } } = useForm({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      branch: user?.branch || '',
      year: user?.year || 1,
      rollNumber: user?.rollNumber || ''
    }
  });

  const { register: registerPassword, handleSubmit: handlePasswordSubmit, formState: { errors: passwordErrors }, reset: resetPassword } = useForm();

  const branches = [
    'Computer Science',
    'Mechanical',
    'Electrical',
    'Civil',
    'Chemical',
    'Electronics'
  ];

  const years = [1, 2, 3, 4];

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'preferences', label: 'Preferences', icon: Settings },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'logout', label: 'Logout', icon: LogOut }
  ];

  const onProfileSubmit = async (data) => {
    try {
      await updateProfile(data);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to update profile');
    }
  };

  const onPasswordSubmit = async (data) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      toast.success('Password changed successfully!');
      resetPassword();
    } catch (error) {
      toast.error(error.message || 'Failed to change password');
    }
  };

  const renderProfileTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className="w-24 h-24 bg-primary mx-auto rounded-full flex items-center justify-center mb-4">
          <User className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{user?.name}</h2>
        <p className="text-gray-600">{user?.email}</p>
      </div>

      <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              {...registerProfile('name', { required: 'Name is required' })}
              className="input w-full pl-10"
              placeholder="Enter your full name"
            />
          </div>
          {profileErrors.name && (
            <p className="text-red-500 text-sm mt-1">{profileErrors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              {...registerProfile('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                  message: 'Invalid email address'
                }
              })}
              className="input w-full pl-10"
              placeholder="Enter your email"
            />
          </div>
          {profileErrors.email && (
            <p className="text-red-500 text-sm mt-1">{profileErrors.email.message}</p>
          )}
        </div>

        {/* Branch and Year */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Branch
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                {...registerProfile('branch', { required: 'Branch is required' })}
                className="input w-full pl-10"
              >
                <option value="">Select Branch</option>
                {branches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            {profileErrors.branch && (
              <p className="text-red-500 text-sm mt-1">{profileErrors.branch.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year
            </label>
            <div className="relative">
              <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                {...registerProfile('year', { required: 'Year is required' })}
                className="input w-full pl-10"
              >
                <option value="">Year</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            {profileErrors.year && (
              <p className="text-red-500 text-sm mt-1">{profileErrors.year.message}</p>
            )}
          </div>
        </div>

        {/* Roll Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Roll Number
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              {...registerProfile('rollNumber', { required: 'Roll number is required' })}
              className="input w-full pl-10"
              placeholder="Enter your roll number"
            />
          </div>
          {profileErrors.rollNumber && (
            <p className="text-red-500 text-sm mt-1">{profileErrors.rollNumber.message}</p>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </form>
    </motion.div>
  );

  const renderSecurityTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Change Password</h3>
        <p className="text-gray-600">Update your password to keep your account secure</p>
      </div>

      <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-6">
        {/* Current Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              {...registerPassword('currentPassword', { required: 'Current password is required' })}
              className="input w-full pl-10 pr-12"
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {passwordErrors.currentPassword && (
            <p className="text-red-500 text-sm mt-1">{passwordErrors.currentPassword.message}</p>
          )}
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showNewPassword ? 'text' : 'password'}
              {...registerPassword('newPassword', { 
                required: 'New password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters'
                }
              })}
              className="input w-full pl-10 pr-12"
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {passwordErrors.newPassword && (
            <p className="text-red-500 text-sm mt-1">{passwordErrors.newPassword.message}</p>
          )}
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="password"
              {...registerPassword('confirmPassword', { required: 'Please confirm your new password' })}
              className="input w-full pl-10"
              placeholder="Confirm new password"
            />
          </div>
          {passwordErrors.confirmPassword && (
            <p className="text-red-500 text-sm mt-1">{passwordErrors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          <Lock className="w-4 h-4" />
          Change Password
        </button>
      </form>
    </motion.div>
  );

  const renderPreferencesTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">App Preferences</h3>
        <p className="text-gray-600">Customize your app experience</p>
      </div>

      <div className="space-y-6">
        {/* Theme */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Palette className="w-5 h-5 text-purple-600" />
            <div>
              <h4 className="font-medium text-gray-900">Theme</h4>
              <p className="text-sm text-gray-600">Choose your preferred theme</p>
            </div>
          </div>
          <select className="input w-32">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-600" />
            <div>
              <h4 className="font-medium text-gray-900">Language</h4>
              <p className="text-sm text-gray-600">Select your language</p>
            </div>
          </div>
          <select className="input w-32">
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="es">Spanish</option>
          </select>
        </div>

        {/* Timezone */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-green-600" />
            <div>
              <h4 className="font-medium text-gray-900">Timezone</h4>
              <p className="text-sm text-gray-600">Your local timezone</p>
            </div>
          </div>
          <select className="input w-40">
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
          </select>
        </div>
      </div>

      <button className="btn btn-primary w-full flex items-center justify-center gap-2">
        <Save className="w-4 h-4" />
        Save Preferences
      </button>
    </motion.div>
  );

  const renderNotificationsTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Notification Settings</h3>
        <p className="text-gray-600">Manage how you receive notifications</p>
      </div>

      <div className="space-y-4">
        {[
          { id: 'assignment', label: 'Assignment Reminders', description: 'Get notified about upcoming assignments' },
          { id: 'schedule', label: 'Schedule Changes', description: 'Notifications when your timetable changes' },
          { id: 'ai', label: 'AI Recommendations', description: 'Receive AI-powered study suggestions' },
          { id: 'deadlines', label: 'Deadline Alerts', description: 'Important deadline notifications' }
        ].map((notification) => (
          <div key={notification.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">{notification.label}</h4>
              <p className="text-sm text-gray-600">{notification.description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        ))}
      </div>

      <button className="btn btn-primary w-full flex items-center justify-center gap-2">
        <Save className="w-4 h-4" />
        Save Settings
      </button>
    </motion.div>
  );

  const renderLogoutTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="mb-6 text-center">
        <div className="w-20 h-20 bg-red-100 mx-auto rounded-full flex items-center justify-center mb-4">
          <LogOut className="w-10 h-10 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Logout</h3>
        <p className="text-gray-600">Sign out of your account</p>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h4 className="font-medium text-red-900 mb-2">Are you sure you want to logout?</h4>
        <p className="text-red-700 mb-4">You will be redirected to the login page</p>
        
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => setActiveTab('profile')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to logout?')) {
                logout();
              }
            }}
            className="btn btn-danger"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile': return renderProfileTab();
      case 'security': return renderSecurityTab();
      case 'preferences': return renderPreferencesTab();
      case 'notifications': return renderNotificationsTab();
      case 'logout': return renderLogoutTab();
      default: return renderProfileTab();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-3 ${
                  activeTab === tab.id
                    ? 'bg-primary text-white shadow-lg'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-lg p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;