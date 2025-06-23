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
const preloadCriticalComponents = () => {
  // Only preload on production and after initial load
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    // Use requestIdleCallback for better performance
    const preloadWhenIdle = (callback) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback);
      } else {
        setTimeout(callback, 100);
      }
    };
    
    preloadWhenIdle(() => {
      import('./pages/Home').catch(() => {});
      import('./pages/UserProfile').catch(() => {});
    });
    
    preloadWhenIdle(() => {
      import('./pages/OwnerDashboard').catch(() => {});
      import('./pages/AdminDashboard').catch(() => {});
    });
  }
};

// Start preloading after a short delay
setTimeout(preloadCriticalComponents, 2000);

// Lazy loaded pages with improved retry logic and fallback
const lazyWithRetry = (componentImport, componentName = 'Component') => {
  return lazy(() => {
    return new Promise((resolve) => {
      const maxRetries = 3;
      let retries = 0;
      
      function attempt() {
        componentImport()
          .then(resolve)
          .catch(error => {
            console.error(`Failed to load ${componentName}:`, error);
            
            if (retries < maxRetries) {
              retries++;
              console.log(`Retrying ${componentName} import (${retries}/${maxRetries})...`);
              
              // Progressive backoff with jitter
              const delay = 1000 * retries + Math.random() * 500;
              setTimeout(attempt, delay);
            } else {
              console.error(`${componentName} import failed after ${maxRetries} retries`);
              
              // Provide a fallback component instead of complete failure
              resolve({
                default: () => (
                  <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center p-8 max-w-md bg-white rounded-lg shadow-lg">
                      <h2 className="text-2xl text-red-600 font-bold mb-4">Loading Error</h2>
                      <p className="text-gray-700 mb-4">
                        Failed to load {componentName}. This might be due to a network issue.
                      </p>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Reload Page
                      </button>
                    </div>
                  </div>
                )
              });
            }
          });
      }
      
      attempt();
    });
  });
};

// Lazy loaded pages with retry mechanism and proper naming
const Home = lazyWithRetry(() => import('./pages/Home'), 'Home');
const Login = lazyWithRetry(() => import('./pages/Login'), 'Login');
const Signup = lazyWithRetry(() => import('./pages/Signup'), 'Signup');
const AuthCallback = lazyWithRetry(() => import('./pages/AuthCallback'), 'AuthCallback');
const ApartmentDetail = lazyWithRetry(() => import('./pages/ApartmentDetail'), 'ApartmentDetail');
const OwnerDashboard = lazyWithRetry(() => import('./pages/OwnerDashboard'), 'OwnerDashboard');
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'), 'AdminDashboard');
const UserProfile = lazyWithRetry(() => import('./pages/UserProfile'), 'UserProfile');
const BecomeOwner = lazyWithRetry(() => import('./pages/BecomeOwner'), 'BecomeOwner');
const Contact = lazyWithRetry(() => import('./pages/Contact'), 'Contact');
const NotFound = lazyWithRetry(() => import('./pages/NotFound'), 'NotFound');
const WriteReview = lazyWithRetry(() => import('./pages/WriteReview'), 'WriteReview');
const ImageTest = lazyWithRetry(() => import('./components/ImageTest'), 'ImageTest');

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
