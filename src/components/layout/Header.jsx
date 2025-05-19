import { useState, useEffect, memo, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

const NavLink = memo(({ to, children, className = '', onClick = null }) => {
  const location = useLocation();
  const isActive = location.pathname === to || 
                  (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link 
      to={to} 
      className={`relative px-3 py-2 text-base transition-all duration-200 ${
        isActive 
          ? 'text-white font-medium' 
          : 'text-gray-300 hover:text-white'
      } ${className}`}
      onClick={onClick}
    >
      {children}
      {isActive && (
        <motion.div 
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full"
          layoutId="activeNavIndicator"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </Link>
  );
});

// Messages Button component
const MessagesButton = memo(({ user }) => {
  const { 
    unreadMessages, 
    showMessageNotification, 
    clearMessageNotification, 
    markAllMessagesAsRead 
  } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  
  // If user is not available, don't render anything
  if (!user) return null;
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && !e.target.closest('.messages-dropdown')) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  // Get recent conversations when dropdown is opened
  useEffect(() => {
    if (isOpen && user) {
      fetchRecentConversations();
      
      // Don't mark messages as read immediately to allow user to see which are unread
      // They'll be marked as read when the user goes to the messages page
      clearMessageNotification();
    }
  }, [isOpen, user]);

  // Position the dropdown in the viewport properly on mobile
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      // Get viewport width
      const viewportWidth = window.innerWidth;
      const dropdown = dropdownRef.current;
      
      // Reset position first
      dropdown.style.left = '';
      dropdown.style.right = '0';
      
      // Get dropdown bounds
      const rect = dropdown.getBoundingClientRect();
      
      // If dropdown is going outside the viewport on the left
      if (rect.left < 0) {
        dropdown.style.left = '0';
        dropdown.style.right = 'auto';
      }
      
      // If dropdown is going outside on the right
      if (rect.right > viewportWidth) {
        // Position from the left to keep it in viewport
        dropdown.style.left = 'auto';
        dropdown.style.right = '0';
        
        // If on very small screens, make it almost full width
        if (viewportWidth < 400) {
          dropdown.style.width = (viewportWidth - 20) + 'px';
        }
      }
    }
  }, [isOpen]);
  
  // Fetch recent conversations
  const fetchRecentConversations = async () => {
    try {
      setLoading(true);
      
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select(`
          *,
          apartments(id, title)
        `)
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .order('updated_at', { ascending: false })
        .limit(5);
        
      if (conversationsError) throw conversationsError;
      
      if (conversationsData) {
        // Get all participant IDs to fetch profiles
        const participantIds = new Set();
        
        conversationsData.forEach(conv => {
          if (conv.participant_one !== user.id) {
            participantIds.add(conv.participant_one);
          }
          if (conv.participant_two !== user.id) {
            participantIds.add(conv.participant_two);
          }
        });
        
        // Fetch profiles for all participants
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', Array.from(participantIds));
        
        if (profilesError) throw profilesError;
        
        // Create a map of profiles by ID
        const profilesMap = (profilesData || []).reduce((map, profile) => {
          map[profile.id] = profile;
          return map;
        }, {});
        
        // Add last message and unread count to each conversation
        const enrichedData = await Promise.all(conversationsData.map(async (conv) => {
          // Determine the other participant
          const otherParticipantId = conv.participant_one === user.id 
            ? conv.participant_two 
            : conv.participant_one;
          
          // Get profile for the other participant
          const otherParticipant = profilesMap[otherParticipantId] || { 
            full_name: 'Unknown User' 
          };
          
          // Get the last message for preview
          const { data: lastMessageData } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          // Count unread messages
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('recipient_id', user.id)
            .eq('is_read', false);
          
          const lastMessage = lastMessageData && lastMessageData.length > 0 
            ? lastMessageData[0] 
            : null;
          
          return {
            ...conv,
            otherParticipant,
            lastMessage,
            unreadCount: unreadCount || 0,
            hasUnread: (unreadCount || 0) > 0
          };
        }));
        
        setConversations(enrichedData);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleNavigateToMessages = (conversationId) => {
    try {
      // Mark messages as read immediately
      markAllMessagesAsRead();
      
      // Close dropdown immediately
      setIsOpen(false);
      
      // Use a sessionStorage flag instead of state parameters to avoid navigation issues
      if (conversationId) {
        sessionStorage.setItem('selected_conversation_id', conversationId);
        sessionStorage.setItem('from_notification', 'true');
      } else {
        sessionStorage.removeItem('selected_conversation_id');
        sessionStorage.removeItem('from_notification');
      }
      
      // Navigate without complex state to prevent React router issues
      navigate('/profile', { 
        state: { activeTab: 'messages' },
        replace: true
      });
    } catch (error) {
      console.error('Navigation error:', error);
      // Simple fallback
      navigate('/profile');
    }
  };
  
  // Handle click on messages icon
  const handleMessagesClick = () => {
    if (!isOpen) {
      // When opening, clear notification
      clearMessageNotification();
    }
    setIsOpen(!isOpen);
  };
  
  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      // Yesterday
      return 'Yesterday';
    } else if (diffDays < 7) {
      // This week - show day name
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      // Older - show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };
  
  // Improve the styling of unread conversations to make them more distinct
  const conversationItemClass = (conv) => {
    if (conv.hasUnread) {
      return 'p-3 border-b border-gray-700 bg-blue-900/30 hover:bg-blue-900/50 cursor-pointer transition-colors';
    }
    return 'p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer transition-colors';
  };
  
  return (
    <div className="relative messages-dropdown">
      <button 
        onClick={handleMessagesClick}
        className="relative flex items-center justify-center w-10 h-10 md:w-auto md:h-auto p-2 text-gray-300 hover:text-white transition-colors"
        aria-label="Messages"
      >
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
          />
        </svg>
        
        {/* Notification badge - enhanced for better mobile visibility */}
        {showMessageNotification && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-xs text-white justify-center items-center font-bold">
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </span>
          </span>
        )}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            ref={dropdownRef}
            className="fixed md:absolute left-2 md:left-auto right-2 md:right-0 mt-2 w-[calc(100vw-16px)] md:w-80 max-w-sm rounded-xl bg-gray-800 shadow-lg border border-gray-700 z-50"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{ maxHeight: '80vh', overflowY: 'auto', top: "50px" }}
          >
            <div className="p-3 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-800 z-10">
              <h3 className="text-sm font-medium text-white">Messages</h3>
              <Link 
                to="/profile" 
                state={{ activeTab: 'messages' }}
                className="text-xs text-primary-400 hover:text-primary-300"
                onClick={() => setIsOpen(false)}
              >
                See all
              </Link>
            </div>
            
            <div className="max-h-[calc(80vh-100px)] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="text-sm mb-1">No messages yet</p>
                  <p className="text-xs">Contact a property owner to get started</p>
                </div>
              ) : (
                <div>
                  {conversations.map(conv => (
                    <div 
                      key={conv.id}
                      className={conversationItemClass(conv)}
                      onClick={() => handleNavigateToMessages(conv.id)}
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mr-3 relative">
                          {conv.otherParticipant.avatar_url ? (
                            <img 
                              src={conv.otherParticipant.avatar_url}
                              alt={conv.otherParticipant.full_name}
                              className="w-8 h-8 rounded-full"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = '/images/default-avatar.svg';
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
                              {conv.otherParticipant.full_name.charAt(0)}
                            </div>
                          )}
                          {conv.hasUnread && (
                            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-gray-800"></span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <p className={`text-sm ${conv.hasUnread ? 'font-bold text-white' : 'font-medium text-white'} truncate`}>
                              {conv.otherParticipant.full_name}
                            </p>
                            <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                              {formatTime(conv.updated_at)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">
                            {conv.apartments?.title || 'Unknown property'}
                          </p>
                          {conv.lastMessage && (
                            <p className={`${conv.hasUnread ? 'text-sm font-medium text-white' : 'text-xs text-gray-300'} mt-1 truncate`}>
                              {conv.lastMessage.sender_id === user.id ? 'You: ' : ''}
                              {conv.lastMessage.message_text}
                            </p>
                          )}
                          {conv.unreadCount > 0 && (
                            <div className="mt-1">
                              <span className="inline-block px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                                {conv.unreadCount} new
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-gray-700 sticky bottom-0 bg-gray-800">
              <Link
                to="/profile"
                state={{ activeTab: 'messages' }}
                className="flex justify-center items-center w-full px-3 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                onClick={() => {
                  markAllMessagesAsRead();
                  setIsOpen(false);
                }}
              >
                View All Messages
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const ProfileButton = memo(({ user, userProfile, userRole, isAdminUser, isOwner, ownerStatus, logout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const { refreshUserProfile, authInitialized } = useAuth();
  
  // Initialize hasAttemptedRefresh from sessionStorage to persist across renders and reloads
  const [hasAttemptedRefresh, setHasAttemptedRefresh] = useState(() => {
    if (user?.id && window.sessionStorage) {
      return sessionStorage.getItem(`profile_refresh_attempted_${user.id}`) === 'true';
    }
    return false;
  });
  
  const [localUserProfile, setLocalUserProfile] = useState(null);
  const initializedRef = useRef(false);
  
  // Show notification if owner status was just approved
  const showOwnerApprovalNotification = ownerStatus?.requestStatus === 'approved' && !ownerStatus?.isOwner;
  
  // Initialize localUserProfile from localStorage on mount and when user changes
  useEffect(() => {
    // Only run this once per user
    if (user?.id && window.localStorage && !initializedRef.current) {
      initializedRef.current = true;
      
      try {
        const cachedProfile = localStorage.getItem(`user_profile_${user.id}`);
        if (cachedProfile) {
          console.log("Initializing local profile from localStorage for user:", user.id);
          setLocalUserProfile(JSON.parse(cachedProfile));
        }
      } catch (e) {
        console.warn('Error reading profile from localStorage:', e);
      }
    }
  }, [user]);
  
  // Update localUserProfile when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setLocalUserProfile(userProfile);
    }
  }, [userProfile]);
  
  const handleLogout = async () => {
    const { success } = await logout();
    if (success) {
      navigate('/login');
    }
  };
  
  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Position the dropdown in the viewport properly on mobile
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      // Get viewport width
      const viewportWidth = window.innerWidth;
      const dropdown = dropdownRef.current.querySelector('.profile-dropdown-menu');
      
      if (dropdown) {
        // Reset position first
        dropdown.style.left = '';
        dropdown.style.right = '0';
        
        // Get dropdown bounds
        const rect = dropdown.getBoundingClientRect();
        
        // If dropdown is going outside the viewport on the left
        if (rect.left < 0) {
          dropdown.style.left = '0';
          dropdown.style.right = 'auto';
        }
        
        // If dropdown is going outside on the right
        if (rect.right > viewportWidth) {
          // Position from the left to keep it in viewport
          dropdown.style.left = 'auto';
          dropdown.style.right = '0';
        }
      }
    }
  }, [isOpen]);
  
  // For debugging
  useEffect(() => {
    console.log("ProfileButton received userProfile:", userProfile);
  }, [userProfile]);
  
  // Try to load profile if user is available but profile isn't
  useEffect(() => {
    // Only attempt to refresh if auth is initialized and we have a user but no profile
    if (authInitialized && user && !userProfile && !hasAttemptedRefresh) {
      console.log("User available but profile is null, refreshing profile");
      
      // Set flag immediately
      setHasAttemptedRefresh(true);
      
      // Store attempt in session storage to prevent repeated attempts across renders
      if (window.sessionStorage) {
        sessionStorage.setItem(`profile_refresh_attempted_${user.id}`, 'true');
      }
      
      // Add a small delay to prevent rapid refreshes
      const timer = setTimeout(() => {
        refreshUserProfile()
          .then(profile => {
            if (profile) {
              setLocalUserProfile(profile);
              console.log("Profile refresh result: Profile loaded successfully");
            } else {
              console.log("Profile refresh result: Profile refresh failed");
              
              // Try localStorage one more time
              try {
                const cachedProfile = localStorage.getItem(`user_profile_${user.id}`);
                if (cachedProfile) {
                  const parsedProfile = JSON.parse(cachedProfile);
                  setLocalUserProfile(parsedProfile);
                  console.log("Loaded profile from localStorage after refresh failed");
                }
              } catch (e) {
                console.warn('Error reading profile from localStorage:', e);
              }
            }
          })
          .catch(err => {
            console.error("Error refreshing profile:", err);
          });
      }, 1500); // Increased delay to prevent rapid refreshes
      
      return () => clearTimeout(timer);
    }
  }, [user, userProfile, refreshUserProfile, hasAttemptedRefresh, authInitialized]);
  
  // Debug console log to check userProfile and avatar_url
  useEffect(() => {
    if (isAdminUser) {
      console.log("Admin user profile:", userProfile || localUserProfile);
      console.log("Admin avatar URL:", (userProfile || localUserProfile)?.avatar_url);
    }
  }, [userProfile, localUserProfile, isAdminUser]);
  
  // Fix for profile image loading
  const refreshImageOnError = (e) => {
    console.log("Image failed to load");
    e.target.onerror = null;
    
    // Try to reload the image with a cache-busting parameter
    const profile = userProfile || localUserProfile;
    if (profile?.avatar_url && profile.avatar_url.trim() !== '' && !e.target.src.includes('?v=')) {
      e.target.src = `${profile.avatar_url}?v=${new Date().getTime()}`;
    } else {
      // Fall back to default if reload fails or URL is empty/null
      e.target.src = '/images/default-avatar.svg';
    }
  };
  
  // Use either provided userProfile or locally cached profile
  const effectiveProfile = userProfile || localUserProfile;
  
  return (
    <div className="relative profile-dropdown" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-full border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-colors"
      >
        <div className="relative">
          {effectiveProfile && effectiveProfile.avatar_url ? (
            <img 
              src={effectiveProfile.avatar_url}
              alt={effectiveProfile?.full_name || 'User'}
              className="w-8 h-8 rounded-full object-cover"
              onError={refreshImageOnError}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          
          {/* Notification badge for owner approval */}
          {showOwnerApprovalNotification && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-gray-800"></span>
          )}
        </div>
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="fixed md:absolute right-2 md:right-0 mt-2 w-[calc(100vw-16px)] md:w-48 rounded-xl bg-gray-800 shadow-lg border border-gray-700 z-50 profile-dropdown-menu"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{ maxWidth: "280px", top: "50px" }}
          >
            <div className="p-3 border-b border-gray-700">
              <p className="text-sm font-medium text-white truncate">{user?.email}</p>
              <p className="text-xs text-gray-400 capitalize">{userRole || 'User'}</p>
            </div>
            
            <div className="py-1">
              <Link 
                to="/profile" 
                className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
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
                  className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
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
                  className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                  onClick={() => setIsOpen(false)}
                >
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin
                  <span className="ml-2 px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                    Admin
                  </span>
                </Link>
              )}
            </div>
            
            <div className="py-1 border-t border-gray-700">
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
  const { user, userRole, logout, isAdmin, isOwner, isAdminUser, ownerStatus, userProfile, authInitialized } = useAuth();
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

  // Decide what to show while auth is initializing
  const renderAuthButtons = () => {
    if (!authInitialized) {
      // Show loading state or skeleton while auth is initializing
      return (
        <div className="flex items-center ml-6 space-x-3">
          <div className="w-20 h-9 bg-gray-700 animate-pulse rounded-md"></div>
          <div className="w-20 h-9 bg-gray-700 animate-pulse rounded-md"></div>
        </div>
      );
    }
    
    if (!user) {
      return (
        <div className="flex items-center ml-6 space-x-3">
          <Link 
            to="/login" 
            className="px-4 py-2 text-primary-400 hover:text-primary-300 font-medium transition-colors"
          >
            Log In
          </Link>
          <Link 
            to="/signup" 
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md shadow-md transition-all"
          >
            Sign Up
          </Link>
        </div>
      );
    }
    
    return (
      <div className="flex items-center space-x-4">
        <MessagesButton user={user} />
        <ProfileButton 
          user={user} 
          userProfile={userProfile} 
          userRole={userRole} 
          isOwner={isOwner}
          isAdminUser={isAdminUser}
          ownerStatus={ownerStatus}
          logout={logout}
        />
      </div>
    );
  };

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-blue-900 shadow-lg py-2' 
        : 'bg-gradient-to-b from-blue-950 to-blue-900/80 backdrop-blur-md py-3'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center">
            <div className="flex items-center">
              <span className="text-white font-bold text-xl">Sompartment</span>
            </div>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            
            {renderAuthButtons()}
          </nav>
          
          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              className="text-gray-300 hover:text-white focus:outline-none"
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            
            {authInitialized && user && (
              <div className="ml-3 flex items-center space-x-1">
                <MessagesButton user={user} />
                <ProfileButton 
                  user={user} 
                  userProfile={userProfile} 
                  userRole={userRole} 
                  isOwner={isOwner}
                  isAdminUser={isAdminUser}
                  ownerStatus={ownerStatus}
                  logout={logout}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="md:hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-2 pt-2 pb-3 space-y-1 bg-blue-950 border-t border-blue-800">
              <Link
                to="/"
                className="block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-blue-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/contact"
                className="block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-blue-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </Link>
              
              {!user && (
                <>
                  <Link
                    to="/login"
                    className="block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-blue-800"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="block px-3 py-2 rounded-md text-base font-medium text-white bg-primary-500 hover:bg-primary-600"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
} 