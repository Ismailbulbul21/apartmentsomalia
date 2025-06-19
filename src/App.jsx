import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Suspense, lazy, useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import React from 'react';

// Layout components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Error Boundary for catching errors in React components
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 max-w-md bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl text-red-600 font-bold mb-4">Something went wrong</h2>
            <p className="text-gray-700 mb-4">We're sorry, but there was an error loading this page.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = '/';
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
            >
              Go back to home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Preload critical components to avoid loading flashes
const preloadedComponents = [
  './pages/Home',
  './pages/UserProfile',
  './pages/OwnerDashboard',
  './pages/AdminDashboard'
];

// Preload important components
preloadedComponents.forEach(path => {
  const preloadComponent = () => import(/* @vite-ignore */ path);
  preloadComponent();
});

// Lazy loaded pages with retry logic
const lazyWithRetry = (componentImport) => {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      const maxRetries = 3;
      let retries = 0;
      
      function attempt() {
        componentImport()
          .then(resolve)
          .catch(error => {
            if (retries < maxRetries) {
              retries++;
              console.log(`Retrying import (${retries}/${maxRetries})...`);
              setTimeout(attempt, 1000 * retries); // Increasing backoff
            } else {
              console.error('Component import failed after retries:', error);
              reject(error);
            }
          });
      }
      
      attempt();
    });
  });
};

// Lazy loaded pages with retry mechanism
const Home = lazyWithRetry(() => import('./pages/Home'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const Signup = lazyWithRetry(() => import('./pages/Signup'));
const AuthCallback = lazyWithRetry(() => import('./pages/AuthCallback'));
const ApartmentDetail = lazyWithRetry(() => import('./pages/ApartmentDetail'));
const OwnerDashboard = lazyWithRetry(() => import('./pages/OwnerDashboard'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));
const UserProfile = lazyWithRetry(() => import('./pages/UserProfile'));
const BecomeOwner = lazyWithRetry(() => import('./pages/BecomeOwner'));
const Contact = lazyWithRetry(() => import('./pages/Contact'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));
const WriteReview = lazyWithRetry(() => import('./pages/WriteReview'));
const ImageTest = lazyWithRetry(() => import('./components/ImageTest'));

// Protected route component with improved loading state
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, userRole, loading } = useAuth();
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  // Set a loading timeout to prevent indefinite loading
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 5000); // 5 second timeout
      
      return () => clearTimeout(timer);
    }
  }, [loading]);
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
        {loadingTimeout && (
          <p className="mt-4 text-gray-600 text-sm">
            This is taking longer than expected. 
            <button 
              onClick={() => window.location.reload()} 
              className="ml-2 text-primary-600 hover:underline"
            >
              Try refreshing
            </button>
          </p>
        )}
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {

  return (
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <div className="flex flex-col min-h-screen bg-gradient-to-br from-night-50 to-night-100">
            <Header />
            <main className="flex-grow relative">
              <AnimatePresence mode="wait">
                <Suspense fallback={
                  <div className="flex items-center justify-center min-h-[60vh]">
                    <LoadingSpinner />
                  </div>
                }>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/apartments/:id" element={<ApartmentDetail />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/test-images" element={<ImageTest />} />

                    {/* User routes */}
                    <Route 
                      path="/profile" 
                      element={
                        <ProtectedRoute>
                          <UserProfile />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/become-owner" 
                      element={
                        <ProtectedRoute>
                          <BecomeOwner />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/review/:apartmentId" 
                      element={
                        <ProtectedRoute>
                          <WriteReview />
                        </ProtectedRoute>
                      } 
                    />

                    {/* Owner routes */}
                    <Route 
                      path="/owner/dashboard/*" 
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin']}>
                          <OwnerDashboard />
                        </ProtectedRoute>
                      } 
                    />

                    {/* Admin routes */}
                    <Route 
                      path="/admin/dashboard/*" 
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <AdminDashboard />
                        </ProtectedRoute>
                      } 
                    />

                    {/* 404 route */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AnimatePresence>
            </main>
            <Footer />
          </div>
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;
