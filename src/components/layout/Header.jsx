import { useState, useEffect, memo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const NavLink = memo(({ to, children, className = '', onClick = null }) => {
  const location = useLocation();
  const isActive = location.pathname === to || 
                  (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link 
      to={to} 
      className={`relative px-3 py-2 text-base transition-all duration-200 ${
        isActive 
          ? 'text-primary-400 font-medium' 
          : 'text-gray-100 hover:text-primary-400'
      } ${className}`}
      onClick={onClick}
    >
      {children}
      {isActive && (
        <motion.div 
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400 rounded-full"
          layoutId="activeNavIndicator"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </Link>
  );
});

const ProfileButton = memo(({ user, userProfile, userRole, handleLogout, isOwner, isAdminUser, ownerStatus }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Owner status indicators
  const showOwnerApprovalNotification = ownerStatus?.requestStatus === 'approved' && !ownerStatus.isOwner;
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && !e.target.closest('.profile-dropdown')) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  return (
    <div className="relative profile-dropdown">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-full border border-night-500 bg-night-700 bg-opacity-70 hover:bg-night-600 transition-colors"
      >
        <div className="relative">
          {userProfile && userProfile.avatar_url ? (
            <img 
              src={userProfile.avatar_url}
              alt={userProfile?.full_name || 'User'}
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                console.error("Image failed to load:", e.target.src);
                e.target.onerror = null;
                // Fallback to initial if image fails to load
                e.target.parentNode.innerHTML = `<div class="w-8 h-8 rounded-full bg-primary-500 bg-opacity-60 flex items-center justify-center text-white font-semibold">${user?.email?.charAt(0).toUpperCase() || 'U'}</div>`;
              }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-500 bg-opacity-60 flex items-center justify-center text-white font-semibold">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          
          {/* Notification badge for owner approval */}
          {showOwnerApprovalNotification && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-night-800"></span>
          )}
        </div>
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="absolute right-0 mt-2 w-48 rounded-xl dark-glass-effect shadow-intense border border-night-500 z-50"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className="p-3 border-b border-night-600">
              <p className="text-sm font-medium text-white truncate">{user?.email}</p>
              <p className="text-xs text-night-200 capitalize">{userRole || 'User'}</p>
            </div>
            
            <div className="py-1">
              <Link 
                to="/profile" 
                className="flex items-center px-4 py-2 text-sm text-night-100 hover:bg-night-700 hover:text-primary-400"
                onClick={() => setIsOpen(false)}
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </Link>
              
              {/* Owner notification */}
              {showOwnerApprovalNotification && (
                <Link 
                  to="/profile" 
                  className="flex items-center px-4 py-2 text-sm text-green-300 bg-green-900 bg-opacity-30 hover:bg-green-800 hover:bg-opacity-40"
                  onClick={() => setIsOpen(false)}
                >
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Owner Approved!
                </Link>
              )}
              
              {isOwner() && (
                <Link 
                  to="/owner/dashboard" 
                  className="flex items-center px-4 py-2 text-sm text-night-100 hover:bg-night-700 hover:text-primary-400"
                  onClick={() => setIsOpen(false)}
                >
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  My Properties
                </Link>
              )}
              
              {isAdminUser && (
                <Link 
                  to="/admin/dashboard" 
                  className="flex items-center px-4 py-2 text-sm text-night-100 hover:bg-night-700 hover:text-primary-400"
                  onClick={() => setIsOpen(false)}
                >
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin
                  <span className="ml-2 px-1.5 py-0.5 text-xs font-bold bg-red-900 text-red-100 rounded-full">
                    Admin
                  </span>
                </Link>
              )}
            </div>
            
            <div className="py-1 border-t border-night-600">
              <button 
                onClick={() => {
                  handleLogout();
                  setIsOpen(false);
                }}
                className="flex w-full items-center px-4 py-2 text-sm text-red-400 hover:bg-red-900 hover:bg-opacity-30"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Log Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default function Header() {
  const { user, userRole, logout, isAdmin, isOwner, isAdminUser, ownerStatus, userProfile } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    const { success } = await logout();
    if (success) {
      navigate('/');
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-gradient-to-b from-night-900 to-night-800 border-b border-night-600 py-2 shadow-lg' 
        : 'bg-gradient-to-b from-night-900/80 to-night-800/70 backdrop-blur-md py-4'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center">
            <div className="flex items-center">
              <span className="text-white font-bold text-xl mr-1">Modern</span>
              <span className="text-primary-400 font-bold text-xl">Flats</span>
            </div>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            
            {!user ? (
              <div className="flex items-center ml-4 space-x-3">
                <Link 
                  to="/login" 
                  className="px-4 py-2 text-primary-400 hover:text-primary-300 font-medium transition-colors"
                >
                  Log In
                </Link>
                <Link 
                  to="/signup" 
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg shadow-lg shadow-primary-900/20 hover:shadow-primary-800/40 transition-all"
                >
                  Sign Up
                </Link>
              </div>
            ) : (
              <ProfileButton 
                user={user}
                userProfile={userProfile}
                userRole={userRole}
                handleLogout={handleLogout}
                isOwner={isOwner}
                isAdminUser={isAdminUser}
                ownerStatus={ownerStatus}
              />
            )}
          </nav>
          
          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-white focus:outline-none"
            onClick={toggleMobileMenu}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} 
              />
            </svg>
          </button>
        </div>
        
        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="md:hidden absolute top-full left-0 right-0 dark-glass-effect border-y border-night-600 z-50"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="py-3 px-4 flex flex-col space-y-3">
                <Link 
                  to="/" 
                  className="text-white hover:text-primary-400 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link 
                  to="/contact" 
                  className="text-white hover:text-primary-400 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contact
                </Link>
                
                {user ? (
                  <>
                    <Link 
                      to="/profile" 
                      className="text-white hover:text-primary-400 py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    
                    {isOwner() && (
                      <Link 
                        to="/owner/dashboard" 
                        className="text-white hover:text-primary-400 py-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        My Properties
                      </Link>
                    )}
                    
                    {isAdminUser && (
                      <Link 
                        to="/admin/dashboard" 
                        className="text-white hover:text-primary-400 py-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Admin Dashboard
                      </Link>
                    )}
                    
                    <button 
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="text-red-400 hover:text-red-300 py-2 text-left"
                    >
                      Log Out
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col space-y-2 pt-2">
                    <Link 
                      to="/login" 
                      className="px-4 py-2 text-center text-primary-400 border border-primary-600 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Log In
                    </Link>
                    <Link 
                      to="/signup" 
                      className="px-4 py-2 text-center bg-primary-600 text-white rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
} 