import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, getProfileImageUrl } from '../lib/supabase';

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

// Save last successful profile fetch timestamp
const saveProfileFetchTime = (userId) => {
  if (!userId) return;
  try {
    localStorage.setItem(`profile_fetch_time_${userId}`, Date.now().toString());
  } catch (e) {
    console.warn('Could not save profile fetch time:', e);
  }
};

// Get last profile fetch time
const getProfileFetchTime = (userId) => {
  if (!userId) return 0;
  try {
    return parseInt(localStorage.getItem(`profile_fetch_time_${userId}`)) || 0;
  } catch (e) {
    return 0;
  }
};

// Save profile data to localStorage for quick loading
const saveProfileToLocalStorage = (userId, profile) => {
  if (!userId || !profile) return;
  try {
    localStorage.setItem(`user_profile_${userId}`, JSON.stringify(profile));
    saveProfileFetchTime(userId);
  } catch (e) {
    console.warn('Could not save profile to localStorage:', e);
  }
};

// Get profile from localStorage
const getProfileFromLocalStorage = (userId) => {
  if (!userId) return null;
  try {
    const profileData = localStorage.getItem(`user_profile_${userId}`);
    return profileData ? JSON.parse(profileData) : null;
  } catch (e) {
    console.warn('Could not read profile from localStorage:', e);
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
  const [authInitialized, setAuthInitialized] = useState(false);

  // Function to set user role with localStorage persistence
  const setUserRoleWithPersistence = (userId, role) => {
    if (role) {
      setUserRole(role);
      saveRoleToLocalStorage(userId, role);
    } else {
      setUserRole(null);
    }
  };

  // Check owner application status
  const checkOwnerStatus = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase.rpc('check_owner_status');
      
      if (error) throw error;
      
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
    if (user?.id && authInitialized) {
      // Check initially
      checkOwnerStatus();
      
      // Set up interval to check every minute
      const interval = setInterval(checkOwnerStatus, 60000);
      
      return () => clearInterval(interval);
    }
  }, [user, authInitialized]);

  // Process avatar URL safely
  const processAvatarUrl = (url) => {
    if (!url || url.trim() === '') {
      return null;
    }
    return getProfileImageUrl(url);
  };

  // Function to fetch user profile and role
  const fetchUserProfile = async (userId) => {
    try {
      console.log('Fetching profile for user:', userId);
      
      // Check localStorage first for quick loading
      const cachedRole = getRoleFromLocalStorage(userId);
      if (cachedRole) {
        console.log('Found cached role:', cachedRole);
        setUserRole(cachedRole);
      }
      
      // Try to get cached profile data first
      const cachedProfile = getProfileFromLocalStorage(userId);
      const lastFetchTime = getProfileFetchTime(userId);
      const profileCacheTTL = 5 * 60 * 1000; // 5 minutes
      
      // Use cached profile if it exists and is fresh (within last 5 minutes)
      if (cachedProfile && Date.now() - lastFetchTime < profileCacheTTL) {
        console.log('Using cached profile data');
        setUserProfile(cachedProfile);
        setUserRoleWithPersistence(userId, cachedProfile.role || 'user');
        
        // Still fetch fresh data in the background
        setTimeout(() => refreshProfileInBackground(userId), 100);
        
        return cachedProfile;
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
          adminProfile.avatar_url = processAvatarUrl(adminProfile.avatar_url);
          
          console.log('Admin profile found:', adminProfile);
          
          // Add the role field
          const profileWithRole = {
            ...adminProfile,
            role: 'admin'
          };
          
          // Save to localStorage
          saveProfileToLocalStorage(userId, profileWithRole);
          
          // Return actual profile with admin role
          return profileWithRole;
        }
        
        // Fallback to hardcoded values if profile fetch fails
        const fallbackProfile = { 
          id: userId,
          role: 'admin', 
          full_name: 'Admin User',
          avatar_url: null // Explicitly set null
        };
        
        saveProfileToLocalStorage(userId, fallbackProfile);
        return fallbackProfile;
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
      }
      
      // If RPC failed, try direct database query as fallback
      if (!profileData) {
        console.log('Fetching profile directly from database');
        const { data: directData, error: directError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
          
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
        profileData.avatar_url = processAvatarUrl(profileData.avatar_url);
        
        // Save to localStorage for future use
        if (profileData.role) {
          saveRoleToLocalStorage(userId, profileData.role);
          setUserRole(profileData.role);
        }
        
        // Save the complete profile to localStorage
        saveProfileToLocalStorage(userId, profileData);
        
        console.log('Profile data loaded successfully:', profileData);
        return profileData;
      }
      
      // Default fallback
      if (cachedRole) {
        const defaultProfile = { id: userId, role: cachedRole, full_name: 'User', avatar_url: null };
        saveProfileToLocalStorage(userId, defaultProfile);
        return defaultProfile;
      }
      
      const userProfile = { id: userId, role: 'user', full_name: 'Default User', avatar_url: null };
      saveProfileToLocalStorage(userId, userProfile);
      return userProfile;
    } catch (err) {
      console.error('Profile fetch error:', err);
      
      // Try localStorage as fallback in case of error
      const cachedRole = getRoleFromLocalStorage(userId);
      if (cachedRole) {
        const fallbackProfile = { id: userId, role: cachedRole, full_name: 'User', avatar_url: null };
        saveProfileToLocalStorage(userId, fallbackProfile);
        return fallbackProfile;
      }
      
      // Default to user role as failsafe
      const defaultProfile = { id: userId, role: 'user', full_name: 'Default User', avatar_url: null };
      saveProfileToLocalStorage(userId, defaultProfile);
      return defaultProfile;
    }
  };

  // Background refresh profile without affecting UI state
  const refreshProfileInBackground = async (userId) => {
    try {
      // Fetch most up-to-date profile directly
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (profileError) {
        return;
      }
      
      // If we have profile data, determine role
      if (profileData) {
        // Process avatar URL
        profileData.avatar_url = processAvatarUrl(profileData.avatar_url);
        
        // Determine user role
        let role = 'user';
        
        // Admin check
        if (userId === ADMIN_USER_ID) {
          role = 'admin';
        } else {
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
        }
        
        // Create the full profile object
        const fullProfile = {
          ...profileData,
          role
        };
        
        // Update localStorage cache
        saveProfileToLocalStorage(userId, fullProfile);
      }
    } catch (error) {
      console.error('Background profile refresh error:', error);
    }
  };

  // Initialize auth state
  useEffect(() => {
    let authTimeout;
    
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // Set a timeout to ensure loading state doesn't get stuck - reduce from 5s to 3s
        authTimeout = setTimeout(() => {
          setLoading(false);
          setAuthInitialized(true);
          
          // Force admin role for known admin user
          if (user?.id === ADMIN_USER_ID) {
            setUserRole('admin');
          }
        }, 3000);
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          
          // Try to get cached profile immediately
          const cachedProfile = getProfileFromLocalStorage(session.user.id);
          if (cachedProfile) {
            setUserProfile(cachedProfile);
            setUserRoleWithPersistence(session.user.id, cachedProfile.role || 'user');
          }
          
          // Fetch profile data (will use cache if available)
          const profile = await fetchUserProfile(session.user.id);
          
          if (profile) {
            setUserRoleWithPersistence(session.user.id, profile.role || 'user');
            // Store the full profile data for access across components
            setUserProfile(profile);
            console.log('Initial profile data:', profile);
          } else {
            setUserRoleWithPersistence(session.user.id, 'user');
          }
        } else {
          setUser(null);
          setUserRole(null);
          setUserProfile(null);
        }
        
        // Auth is now initialized
        setAuthInitialized(true);
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        clearTimeout(authTimeout);
        setLoading(false);
        setAuthInitialized(true);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          
          // Try to use cached profile for immediate update
          const cachedProfile = getProfileFromLocalStorage(session.user.id);
          if (cachedProfile) {
            setUserProfile(cachedProfile);
            setUserRoleWithPersistence(session.user.id, cachedProfile.role || 'user');
          }
          
          // Fetch profile data
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setUserRoleWithPersistence(session.user.id, profile.role || 'user');
            setUserProfile(profile);
          } else {
            setUserRoleWithPersistence(session.user.id, 'user');
          }
        } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          setUser(null);
          setUserRole(null);
          setUserProfile(null);
        } else if ((event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
          // Always update user data on token refresh
          setUser(session.user);
          
          // Fetch profile data
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setUserRoleWithPersistence(session.user.id, profile.role || 'user');
            setUserProfile(profile);
          } else {
            setUserRoleWithPersistence(session.user.id, 'user');
          }
        } else if (session?.user && (!user || user.id !== session.user.id)) {
          // Session exists but user state doesn't match
          setUser(session.user);
          
          // Fetch profile data
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setUserRoleWithPersistence(session.user.id, profile.role || 'user');
            setUserProfile(profile);
          } else {
            setUserRoleWithPersistence(session.user.id, 'user');
          }
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
      clearTimeout(authTimeout);
    };
  }, []);

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
          localStorage.removeItem(`user_profile_${user.id}`);
          localStorage.removeItem(`profile_fetch_time_${user.id}`);
          localStorage.removeItem(`last_profile_refresh_${user.id}`);
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
    if (user?.id && authInitialized) {
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
  }, [user, authInitialized]);

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
    authInitialized,
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
          console.log('Current userProfile state:', userProfile);
          
          // Check if we recently refreshed to prevent infinite loops
          const now = Date.now();
          const lastRefresh = parseInt(localStorage.getItem(`last_profile_refresh_${user.id}`)) || 0;
          const refreshThreshold = 5000; // 5 seconds
          
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
          
          // Try cached version first for immediate response
          const cachedProfile = getProfileFromLocalStorage(user.id);
          const shouldUseCachedVersion = cachedProfile && 
                                        Date.now() - getProfileFetchTime(user.id) < 300000; // 5 minutes
          
          if (shouldUseCachedVersion) {
            if (!userProfile) {
              setUserProfile(cachedProfile);
              setUserRoleWithPersistence(user.id, cachedProfile.role || 'user');
            }
            
            // Still fetch updated data in background
            refreshProfileInBackground(user.id);
            return cachedProfile;
          }
          
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
            profileData.avatar_url = processAvatarUrl(profileData.avatar_url);
            
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
            
            // Update localStorage cache
            saveProfileToLocalStorage(user.id, fullProfile);
            
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
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
}; 