import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, getProfileImageUrl, checkConnection, recoverSession } from '../lib/supabase';

const AuthContext = createContext();

// Get admin user ID from environment variable
const ADMIN_USER_ID = import.meta.env.VITE_ADMIN_USER_ID || '8bc778e8-4990-4166-90d3-d667e55928e2';

// Helper functions for localStorage
const saveRoleToLocalStorage = (userId, role) => {
  if (!userId || !role) return;
  try {
    localStorage.setItem(`user_role_${userId}`, role);
  } catch (e) {
    console.warn('Could not save role to localStorage:', e);
  }
};

const getRoleFromLocalStorage = (userId) => {
  if (!userId) return null;
  try {
    return localStorage.getItem(`user_role_${userId}`);
  } catch (e) {
    console.warn('Could not read role from localStorage:', e);
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [ownerStatus, setOwnerStatus] = useState({
    isOwner: false,
    hasPendingRequest: false,
    requestStatus: null,
    rejectionReason: null
  });
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showMessageNotification, setShowMessageNotification] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Function to set user role with localStorage persistence
  const setUserRoleWithPersistence = (userId, role) => {
    if (role) {
      setUserRole(role);
      saveRoleToLocalStorage(userId, role);
    } else {
      setUserRole(null);
    }
  };

  // Function to check and recover database connection
  const checkAndRecoverConnection = async () => {
    try {
      const { isHealthy, error } = await checkConnection();
      
      if (!isHealthy) {
        console.warn('Detected connection issues:', error);
        setConnectionError(true);
        
        // Schedule reconnection attempt
        const nextAttempt = reconnectAttempt + 1;
        setReconnectAttempt(nextAttempt);
        
        // Exponential backoff for reconnection (max 30s)
        const delay = Math.min(Math.pow(2, nextAttempt) * 1000, 30000);
        setTimeout(() => checkAndRecoverConnection(), delay);
      } else {
        // Connection is healthy, clear error state if it was set
        if (connectionError) {
          console.log('Connection recovered');
          setConnectionError(false);
          setReconnectAttempt(0);
          
          // Re-initialize auth if user exists but profile data might be incomplete
          if (user && !userProfile) {
            initializeUserData(user.id);
          }
        }
      }
    } catch (err) {
      console.error('Error checking connection:', err);
      setConnectionError(true);
    }
  };

  // Check owner application status
  const checkOwnerStatus = async () => {
    if (!user?.id || connectionError) return;
    
    try {
      const { data, error } = await supabase.rpc('check_owner_status');
      
      if (error) {
        if (error.message.includes('connection') || error.code === 'PGRST_CONNECTION_ERROR') {
          setConnectionError(true);
          setTimeout(() => checkAndRecoverConnection(), 2000);
          return;
        }
        throw error;
      }
      
      if (data) {
        setOwnerStatus({
          isOwner: data.is_owner || false,
          hasPendingRequest: data.has_pending_request || false,
          requestStatus: data.request_status,
          rejectionReason: data.rejection_reason
        });
        
        // If user is an owner but role doesn't reflect that, update it
        if (data.is_owner && userRole !== 'owner' && userRole !== 'admin') {
          setUserRoleWithPersistence(user.id, 'owner');
        }
      }
    } catch (error) {
      console.error('Error checking owner status:', error);
    }
  };

  // Refresh owner status periodically when logged in
  useEffect(() => {
    if (user?.id && !connectionError) {
      // Check initially
      checkOwnerStatus();
      
      // Set up interval to check every minute
      const interval = setInterval(checkOwnerStatus, 60000);
      
      return () => clearInterval(interval);
    }
  }, [user, connectionError]);

  // Function to fetch user profile and role
  const fetchUserProfile = async (userId) => {
    if (!userId || connectionError) {
      return null;
    }
    
    try {
      console.log('Fetching profile for user:', userId);
      
      // Check localStorage first for quick loading
      const cachedRole = getRoleFromLocalStorage(userId);
      if (cachedRole) {
        console.log('Found cached role:', cachedRole);
        setUserRole(cachedRole);
      }
      
      // Special case for known admin user
      if (userId === ADMIN_USER_ID) {
        console.log('Using hardcoded admin role for known admin user');
        saveRoleToLocalStorage(userId, 'admin');
        
        // Get actual profile data for admin user instead of hardcoded values
        const { data: adminProfile, error: adminProfileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (!adminProfileError && adminProfile) {
          // Process avatar URL if present
          if (adminProfile.avatar_url && adminProfile.avatar_url.trim() !== '') {
            adminProfile.avatar_url = getProfileImageUrl(adminProfile.avatar_url);
          } else {
            // Explicitly set to null if empty to avoid empty string issues
            adminProfile.avatar_url = null;
          }
          
          console.log('Admin profile found:', adminProfile);
          
          // Return actual profile with admin role
          return {
            ...adminProfile,
            role: 'admin'
          };
        }
        
        // Fallback to hardcoded values if profile fetch fails
        return { 
          id: userId,
          role: 'admin', 
          full_name: 'Admin User',
          avatar_url: null // Explicitly set null
        };
      }
      
      let profileData = null;
      
      // Try RPC call first
      try {
        const { data: directProfile, error: directError } = await supabase.rpc('get_user_profile', {
          user_id: userId
        });
        
        if (!directError && directProfile && directProfile.length > 0) {
          // Extract the first item from the array
          profileData = directProfile[0];
        } else {
          console.log('RPC call failed or returned no data, falling back to direct query');
        }
      } catch (rpcErr) {
        console.error('RPC error:', rpcErr);
        
        // Check if this is a connection error
        if (rpcErr.message && 
            (rpcErr.message.includes('network') || 
             rpcErr.message.includes('connection') || 
             rpcErr.code === 'PGRST_CONNECTION_ERROR')) {
          setConnectionError(true);
          setTimeout(() => checkAndRecoverConnection(), 2000);
        }
      }
      
      // If RPC failed, try direct database query as fallback
      if (!profileData) {
        console.log('Fetching profile directly from database');
        const { data: directData, error: directError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
          
        if (directError) {
          // Check for connection errors specifically
          if (directError.message && 
              (directError.message.includes('network') || 
               directError.message.includes('connection') || 
               directError.code === 'PGRST_CONNECTION_ERROR')) {
            setConnectionError(true);
            setTimeout(() => checkAndRecoverConnection(), 2000);
            
            // Use cached data if available while connection is being restored
            if (cachedRole) {
              return { id: userId, role: cachedRole, full_name: 'Cached User', avatar_url: null };
            }
          }
        }
          
        if (!directError && directData) {
          // For direct query, we need to determine role separately
          let role = 'user';
          
          // Check if user is an owner
          const { data: ownerData } = await supabase
            .from('owner_requests')
            .select('status')
            .eq('user_id', userId)
            .eq('status', 'approved')
            .maybeSingle();
            
          if (ownerData) {
            role = 'owner';
          }
          
          profileData = {
            ...directData,
            role
          };
        }
      }
      
      // Process the profile data
      if (profileData) {
        // Process avatar URL if present
        if (profileData.avatar_url) {
          if (profileData.avatar_url && profileData.avatar_url.trim() !== '') {
            profileData.avatar_url = getProfileImageUrl(profileData.avatar_url);
          } else {
            // Set to null to avoid empty string issues
            profileData.avatar_url = null;
          }
        }
        
        // Save to localStorage for future use
        if (profileData.role) {
          saveRoleToLocalStorage(userId, profileData.role);
          setUserRole(profileData.role);
        }
        
        console.log('Profile data loaded successfully:', profileData);
        return profileData;
      }
      
      // Default fallback
      if (cachedRole) {
        return { id: userId, role: cachedRole, full_name: 'User', avatar_url: null };
      }
      
      return { id: userId, role: 'user', full_name: 'Default User', avatar_url: null };
    } catch (err) {
      console.error('Profile fetch error:', err);
      
      // Check if this is a connection error
      if (err.message && 
          (err.message.includes('network') || 
           err.message.includes('connection') ||
           err.code === 'PGRST_CONNECTION_ERROR')) {
        setConnectionError(true);
        setTimeout(() => checkAndRecoverConnection(), 2000);
      }
      
      // Try localStorage as fallback in case of error
      const cachedRole = getRoleFromLocalStorage(userId);
      if (cachedRole) {
        return { id: userId, role: cachedRole, full_name: 'User', avatar_url: null };
      }
      
      // Default to user role as failsafe
      return { id: userId, role: 'user', full_name: 'Default User', avatar_url: null };
    }
  };
  
  // Function to initialize user data from ID
  const initializeUserData = async (userId) => {
    if (!userId) {
      setLoading(false);
      setUser(null);
      setUserProfile(null);
      setUserRole(null);
      return;
    }
  
    try {
      // Fetch user profile data
      const profileData = await fetchUserProfile(userId);
      setUserProfile(profileData);
      
      if (profileData?.role) {
        setUserRole(profileData.role);
      }
      
      // Check for unread messages
      if (!connectionError) {
        checkUnreadMessages();
      }
    } catch (error) {
      console.error('Error initializing user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initialize auth state
  useEffect(() => {
    let authTimeout;
    let authSubscription;
    
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // Set a timeout to ensure loading state doesn't get stuck
        authTimeout = setTimeout(() => {
          setLoading(false);
          
          // Force admin role for known admin user if we have it
          if (user?.id === ADMIN_USER_ID) {
            setUserRole('admin');
          }
        }, 3000);
        
        // Initial connection health check
        await checkAndRecoverConnection();
        
        // Attempt session recovery if needed
        await recoverSession();
        
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        
        // If we have a session, set the user
        if (session?.user) {
          setUser(session.user);
          // Initialize user data (profile, role, etc.)
          await initializeUserData(session.user.id);
        } else {
          // No session, clear user state
          setUser(null);
          setUserProfile(null);
          setUserRole(null);
          setLoading(false);
        }
        
        // Set up auth state change listener
        authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('Auth state change:', event);
          
          if (event === 'SIGNED_IN' && session?.user) {
            setUser(session.user);
            await initializeUserData(session.user.id);
          } 
          else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
            setUser(null);
            setUserProfile(null);
            setUserRole(null);
            
            // Clear role from localStorage
            try {
              Object.keys(localStorage)
                .filter(key => key.startsWith('user_role_'))
                .forEach(key => localStorage.removeItem(key));
            } catch (e) {
              console.warn('Error clearing localStorage:', e);
            }
          } 
          else if (event === 'TOKEN_REFRESHED' && session?.user) {
            // Just update the user object, no need to reload profile
            setUser(session.user);
          }
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        setLoading(false);
        
        // If there's an error, attempt to recover
        setConnectionError(true);
        setTimeout(() => checkAndRecoverConnection(), 2000);
      }
    };
    
    initializeAuth();
    
    // Cleanup function
    return () => {
      clearTimeout(authTimeout);
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  // Reconnection check on visibility change (tab focus)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && (connectionError || !user)) {
        console.log('Tab became visible, checking connection and session...');
        await checkAndRecoverConnection();
        
        // Also check if we need to recover the session
        const { recovered, hasSession } = await recoverSession();
        
        if (recovered || (hasSession && !user)) {
          // Session recovered but our local state doesn't know it
          // Re-initialize auth
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setUser(session.user);
            await initializeUserData(session.user.id);
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Check when coming back from history navigation
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        // Page was restored from the bfcache
        handleVisibilityChange();
      }
    });
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handleVisibilityChange);
    };
  }, [connectionError, user]);

  // Login function
  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Signup function
  const signup = async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // First set state to null to prevent UI flicker
      setUser(null);
      setUserRole(null);
      setUserProfile(null);
      setOwnerStatus({
        isOwner: false,
        hasPendingRequest: false,
        requestStatus: null,
        rejectionReason: null
      });
      
      // Clear any cached user data
      try {
        if (user?.id) {
          localStorage.removeItem(`user_role_${user.id}`);
        }
      } catch (e) {
        console.warn('Error clearing localStorage cache:', e);
      }
      
      // Then perform the actual sign out
      const { error } = await supabase.auth.signOut({
        scope: 'global' // Sign out from all tabs
      });
      
      if (error) throw error;
      
      // Use navigate instead of direct page reload for smoother experience
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  // Update user to become an owner
  const becomeOwner = async (businessDetails) => {
    try {
      // Log the business details for debugging
      console.log("Submitting owner request with data:", businessDetails);
      
      // Prepare the business data for the RPC function
      // We'll send the exact format needed by the RPC function
      const businessData = {
        businessName: businessDetails.businessName || '',
        businessPhone: businessDetails.businessPhone || '',
        businessAddress: businessDetails.businessAddress || '',
        businessDescription: businessDetails.businessDescription || '',
        whatsappNumber: businessDetails.whatsappNumber || ''
      };
      
      console.log("Business data to submit:", businessData);
      
      // Call the new RPC function with the business data object
      const { data, error } = await supabase.rpc(
        'create_owner_request',
        { business_data: businessData }
      );
      
      // Log full error details for debugging
      if (error) {
        console.error("RPC Error Details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log("RPC call successful:", data);
      
      // Update owner status after submission
      await checkOwnerStatus();
      
      // Return success response
      return { 
        success: true, 
        data, 
        message: "Your request to become an owner has been submitted and is pending admin approval." 
      };
    } catch (error) {
      console.error("Owner request failed:", error);
      return { success: false, error: error.message };
    }
  };

  // Check if user is admin
  const isAdmin = () => {
    // For the specific user ID, always return true as fallback
    if (user?.id === ADMIN_USER_ID) {
      return true;
    }
    // Normal check
    return userRole === 'admin';
  };
  
  // Check if user is owner
  const isOwner = () => {
    // For the specific user ID, always return true as fallback
    if (user?.id === ADMIN_USER_ID) {
      return true;
    }
    // Normal check
    return userRole === 'owner' || userRole === 'admin'; // Admins can also access owner features
  };
  
  // Function to manually refresh owner status
  const refreshOwnerStatus = () => {
    return checkOwnerStatus();
  };

  // Check for unread messages
  const checkUnreadMessages = async () => {
    if (!user?.id) return 0;
    
    try {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      
      if (error) throw error;
      
      setUnreadMessages(count || 0);
      setShowMessageNotification(count > 0);
      
      return count || 0;
    } catch (error) {
      console.error('Error checking unread messages:', error);
      return 0;
    }
  };

  // Function to mark all messages as read
  const markAllMessagesAsRead = async () => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      
      setUnreadMessages(0);
      setShowMessageNotification(false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Reset notification display (called when clicking message icon)
  const clearMessageNotification = () => {
    setShowMessageNotification(false);
  };

  // Refresh unread messages count periodically when logged in
  useEffect(() => {
    if (user?.id) {
      // Check initially
      checkUnreadMessages();
      
      // Set up interval to check every 30 seconds
      const interval = setInterval(checkUnreadMessages, 30000);
      
      // Subscribe to message inserts for real-time notifications
      const messageSubscription = supabase
        .channel('public:messages')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `recipient_id=eq.${user.id}` 
          },
          () => {
            checkUnreadMessages();
          }
        )
        .subscribe();
      
      return () => {
        clearInterval(interval);
        supabase.removeChannel(messageSubscription);
      };
    }
  }, [user]);

  const value = {
    user,
    userRole,
    userProfile,
    loading,
    login,
    signup,
    logout,
    becomeOwner,
    isAdmin,
    isOwner,
    ownerStatus,
    refreshOwnerStatus,
    // Special admin flag that can be checked directly
    isAdminUser: user?.id === ADMIN_USER_ID || userRole === 'admin',
    // Message notification features
    unreadMessages,
    showMessageNotification,
    checkUnreadMessages,
    markAllMessagesAsRead,
    clearMessageNotification,
    refreshUserProfile: async () => {
      if (user?.id) {
        try {
          console.log('Manually refreshing profile for user:', user.id);
          
          // Check if we recently refreshed to prevent infinite loops
          const now = Date.now();
          const lastRefresh = parseInt(localStorage.getItem(`last_profile_refresh_${user.id}`)) || 0;
          const refreshThreshold = 3000; // 3 seconds
          
          // Check if userProfile is already set to avoid unnecessary refreshes
          if (userProfile && userProfile.id === user.id) {
            // Only check timestamp if we already have a profile
            if (now - lastRefresh < refreshThreshold) {
              console.log('Profile refresh throttled, using existing data');
              return userProfile;
            }
            
            console.log('Profile already loaded, using existing data');
          }
          
          // Update the refresh timestamp
          localStorage.setItem(`last_profile_refresh_${user.id}`, now.toString());
          
          // Directly query the database for most up-to-date profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.error('Error fetching profile directly:', profileError);
            
            // Check if we already have a profile before falling back
            if (userProfile) {
              console.log('Using existing profile as fallback');
              return userProfile;
            }
            
            // Fall back to fetchUserProfile if direct query fails
            const profile = await fetchUserProfile(user.id);
            if (profile) {
              setUserProfile(profile);
              setUserRoleWithPersistence(user.id, profile.role || 'user');
              return profile;
            }
            return null;
          }
          
          // If we have profile data, determine role
          if (profileData) {
            // Process avatar URL
            if (profileData.avatar_url && profileData.avatar_url.trim() !== '') {
              profileData.avatar_url = getProfileImageUrl(profileData.avatar_url);
            } else {
              // Set to null if empty or undefined
              profileData.avatar_url = null;
            }
            
            // Determine user role
            let role = 'user';
            
            // Admin check
            if (user.id === ADMIN_USER_ID) {
              role = 'admin';
            } else {
              // Check if user is an owner
              const { data: ownerData } = await supabase
                .from('owner_requests')
                .select('status')
                .eq('user_id', user.id)
                .eq('status', 'approved')
                .maybeSingle();
                
              if (ownerData) {
                role = 'owner';
              }
            }
            
            // Create the full profile object
            const fullProfile = {
              ...profileData,
              role
            };
            
            // Update states
            console.log('Updated profile:', fullProfile);
            setUserRoleWithPersistence(user.id, role);
            setUserProfile(fullProfile);
            
            // Also refresh other related states
            await checkOwnerStatus();
            await checkUnreadMessages();
            
            return fullProfile;
          }
          
          return null;
        } catch (err) {
          console.error('Error refreshing user profile:', err);
          
          // Return existing profile if available as fallback
          if (userProfile) {
            console.log('Error occurred, using existing profile as fallback');
            return userProfile;
          }
          
          return null;
        }
      }
      return userProfile || null;
    },
    connectionError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
}; 