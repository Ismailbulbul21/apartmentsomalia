import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Suspense, lazy } from 'react';
import { AnimatePresence } from 'framer-motion';

// Layout components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Lazy loaded pages
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ApartmentDetail = lazy(() => import('./pages/ApartmentDetail'));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const BecomeOwner = lazy(() => import('./pages/BecomeOwner'));
const Contact = lazy(() => import('./pages/Contact'));
const NotFound = lazy(() => import('./pages/NotFound'));
const WriteReview = lazy(() => import('./pages/WriteReview'));

// Protected route component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, userRole, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  
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
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-night-50 to-night-100">
          <Header />
          <main className="flex-grow relative">
            <AnimatePresence mode="wait">
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/apartments/:id" element={<ApartmentDetail />} />
                  <Route path="/contact" element={<Contact />} />

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
      </AuthProvider>
    </Router>
  );
}

export default App;
