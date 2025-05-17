import { Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import AdminDashboard from '../components/admin/AdminDashboard';

// Main AdminDashboard page wrapper
export default function AdminDashboardPage() {
  const { user, loading, isAdmin } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!user || !isAdmin()) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <AdminDashboard />
    </motion.div>
  );
} 