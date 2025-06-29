import { useState, useEffect } from 'react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

// Import admin components
import ManageUsers from './ManageUsers';
import AllListings from './AllListings';
import PendingOwners from './PendingOwners';

// Dashboard tabs
const tabs = [
  { name: 'Pending Owners', path: 'owners', icon: '🔑' },
  { name: 'Manage Users', path: 'users', icon: '👥' },
  { name: 'All Listings', path: 'listings', icon: '🏠' },
];

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('owners');
  const { user, refreshUserProfile } = useAuth();
  
  // Ensure user profile is loaded in admin dashboard
  useEffect(() => {
    if (user) {
      refreshUserProfile();
    }
  }, [user]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="container mx-auto px-4 py-4 md:py-8"
    >
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Admin Dashboard</h1>
      
      {/* Navigation tabs - vertical on mobile, horizontal on larger screens */}
      <div className="md:flex mb-4 md:mb-6 bg-white rounded-lg shadow overflow-hidden">
        {/* Mobile tabs - scrollable horizontal */}
        <div className="flex md:hidden overflow-x-auto p-1 scrollbar-hide">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={`/admin/dashboard/${tab.path}`}
              className={({ isActive }) => 
                `flex-shrink-0 mr-2 px-4 py-3 text-center rounded-md transition-all whitespace-nowrap
                ${isActive 
                  ? 'bg-primary-600 text-white font-medium' 
                  : 'text-gray-700 hover:bg-gray-100'}`
              }
              onClick={() => setActiveTab(tab.path)}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </NavLink>
          ))}
        </div>
        
        {/* Desktop tabs */}
        <div className="hidden md:flex w-full p-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={`/admin/dashboard/${tab.path}`}
              className={({ isActive }) => 
                `flex-1 px-4 py-3 text-center rounded-md transition-all
                ${isActive 
                  ? 'bg-primary-600 text-white font-medium' 
                  : 'text-gray-700 hover:bg-gray-100'}`
              }
              onClick={() => setActiveTab(tab.path)}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </NavLink>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="bg-gray-50 rounded-lg p-3 md:p-6">
        <Routes>
          <Route path="owners" element={<PendingOwners />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="listings" element={<AllListings />} />
          <Route path="/" element={<Navigate to="/admin/dashboard/owners" replace />} />
        </Routes>
      </div>
    </motion.div>
  );
};

export default AdminDashboard; 