import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, getProfileImageUrl } from '../lib/supabase';

const AuthContext = createContext();

// Get admin user ID from environment variable only
const ADMIN_USER_ID = import.meta.env.VITE_ADMIN_USER_ID;

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
    
    // If no data found, return null
    if (!profileData) return null;
    
    // Try to parse the data
    try {
      const parsedData = JSON.parse(profileData);
      
      // Validate that the parsed data is a valid profile object
      if (!parsedData || typeof parsedData !== 'object' || !parsedData.id) {
        console.warn('Invalid profile data in localStorage, clearing it');
        localStorage.removeItem(`user_profile_${userId}`);
        return null;
      }
      
      // Check if the profile data is for the correct user
      if (parsedData.id !== userId) {
        console.warn('Profile data mismatch, clearing it');
        localStorage.removeItem(`user_profile_${userId}`);
        return null;
      }
      
      return parsedData;
    } catch (parseError) {
      console.warn('Failed to parse profile data from localStorage:', parseError);
      // Clear invalid data
      localStorage.removeItem(`user_profile_${userId}`);
      return null;
    }
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
  const [roleChangeNotification, setRoleChangeNotification] = useState(null);

  // Function to set user role with localStorage persistence
  const setUserRoleWithPersistence = (userId, role, previousRole = null) => {
    if (role) {
      setUserRole(role);
      saveRoleToLocalStorage(userId, role);
      
      // If previous role is provided and different from new role, show notification
      if (previousRole && previousRole !== role) {
        setRoleChangeNotification({
          previousRole,
          newRole: role,
          timestamp: new Date().toISOString()
        });
        
        // Auto-clear notification after 10 seconds
        setTimeout(() => {
          setRoleChangeNotification(null);
        }, 10000);
      }
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
  const fetchUserProfile = async (userId, retryAttempt = 0) => {
    const maxRetries = 2; // Maximum number of retry attempts
    
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
      
      // Special case for known admin user (only if ADMIN_USER_ID env var is set)
      if (ADMIN_USER_ID && userId === ADMIN_USER_ID) {
        console.log('Admin user identified via environment variable');
        saveRoleToLocalStorage(userId, 'admin');
        
        // Get actual profile data for admin user
        const { data: adminProfile, error: adminProfileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (!adminProfileError && adminProfile) {
          // Process avatar URL if present
          adminProfile.avatar_url = processAvatarUrl(adminProfile.avatar_url);
          
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
      }
      
      // For normal users, fetch profile and determine role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
        
        // If we've already tried a few times, just return what we have
        if (retryAttempt >= maxRetries) {
          console.warn(`Max retries (${maxRetries}) reached for profile fetch, using fallback`);
          
          // If we have a cached role, use it
          if (cachedRole) {
            return {
              id: userId,
              role: cachedRole,
              created_at: new Date().toISOString()
            };
          }
          
          // Otherwise return a default profile
          return {
            id: userId,
            role: 'user',
            created_at: new Date().toISOString()
          };
        }
        
        // Try again after a short delay
        console.log(`Retrying profile fetch (attempt ${retryAttempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchUserProfile(userId, retryAttempt + 1);
      }
      
      if (profileData) {
        // Get avatar URL if present
        profileData.avatar_url = processAvatarUrl(profileData.avatar_url);
        
        // IMPORTANT CHANGE: Prioritize the role from the profiles table
        let role = profileData.role || 'user';
        
        // Only override with admin role if specifically set in env var
        if (userId === ADMIN_USER_ID) {
          role = 'admin';
        } 
        // Only check owner_requests if role is not already set to owner or admin
        else if (role !== 'owner' && role !== 'admin') {
          // Check if user is an owner via owner_requests table
          try {
            const { data: ownerData } = await supabase
              .from('owner_requests')
              .select('status')
              .eq('user_id', userId)
              .eq('status', 'approved')
              .maybeSingle();
              
            if (ownerData) {
              role = 'owner';
              
              // Update the profile with owner role if needed
              if (profileData.role !== 'owner') {
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ role: 'owner' })
                  .eq('id', userId);
                  
                if (updateError) {
                  console.warn('Failed to update profile with owner role:', updateError);
                }
              }
            }
          } catch (ownerCheckError) {
            console.error('Error checking owner status:', ownerCheckError);
            // If we can't check owner status, default to cached role or 'user'
            if (!role) {
              role = cachedRole || 'user';
            }
          }
        }
        
        // Set profile with role
        const profileWithRole = {
          ...profileData,
          role
        };
        
        // Save to localStorage for next time
        saveProfileToLocalStorage(userId, profileWithRole);
        
        return profileWithRole;
      } else {
        // No profile found, but we have a user ID, so create a default profile
        console.log('No profile found for user, creating default');
        const defaultProfile = {
          id: userId,
          role: cachedRole || 'user',
          created_at: new Date().toISOString()
        };
        
        // Return the default profile
        return defaultProfile;
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      
      // Retry logic for unexpected errors
      if (retryAttempt < maxRetries) {
        console.log(`Retrying profile fetch after error (${retryAttempt + 1}/${maxRetries})...`);
        const delay = Math.pow(2, retryAttempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchUserProfile(userId, retryAttempt + 1);
      }
      
      // If we reached max retries, return a minimal profile to prevent UI errors
      return { 
        id: userId, 
        role: cachedRole || 'user',
        error: error.message 
      };
    }
  };

  // Function to refresh profile data in the background
  const refreshProfileInBackground = async (userId) => {
    try {
      console.log('Refreshing profile in background for user:', userId);
      
      // Fetch fresh profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.warn('Error refreshing profile in background:', profileError);
        return;
      }
      
      if (profileData) {
        // Process avatar URL
        profileData.avatar_url = processAvatarUrl(profileData.avatar_url);
        
        // IMPORTANT CHANGE: Prioritize the role from the profiles table
        let role = profileData.role || 'user';
        
        // Only override with admin role if specifically set in env var
        if (userId === ADMIN_USER_ID) {
          role = 'admin';
        } 
        // Only check owner_requests if role is not already set to owner or admin
        else if (role !== 'owner' && role !== 'admin') {
          // Check if user is an owner
          try {
            const { data: ownerData } = await supabase
              .from('owner_requests')
              .select('status')
              .eq('user_id', userId)
              .eq('status', 'approved')
              .maybeSingle();
              
            if (ownerData) {
              role = 'owner';
              
              // Update the profile with owner role if needed
              if (profileData.role !== 'owner') {
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ role: 'owner' })
                  .eq('id', userId);
                  
                if (updateError) {
                  console.warn('Failed to update profile with owner role:', updateError);
                }
              }
            }
          } catch (ownerError) {
            console.warn('Error checking owner status in background:', ownerError);
            // Keep existing role on error
            const existingRole = getRoleFromLocalStorage(userId);
            if (existingRole && !role) {
              role = existingRole;
            }
          }
        }
        
        // Create the full profile object
        const fullProfile = {
          ...profileData,
          role
        };
        
        // Update localStorage cache
        saveProfileToLocalStorage(userId, fullProfile);
        
        // Check if user state is still the same user
        // This prevents updating state for a user who has logged out/changed
        if (user?.id === userId) {
          // Silently update the role if it changed
          if (role !== userRole) {
            setUserRoleWithPersistence(userId, role);
          }
          
          // Update the profile state if needed
          setUserProfile(prevProfile => {
            // Only update if meaningful changes
            if (JSON.stringify(prevProfile) !== JSON.stringify(fullProfile)) {
              return fullProfile;
            }
            return prevProfile;
          });
        }
      }
    } catch (error) {
      console.warn('Error in background profile refresh:', error);
    }
  };

  // Initialize auth state
  useEffect(() => {
    let authTimeout;
    let retryCount = 0;
    const maxRetries = 3;
    
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // Clear any existing timeout
        if (authTimeout) {
          clearTimeout(authTimeout);
        }
        
        // Set a timeout to ensure loading state doesn't get stuck - increased from 3s to 5s
        authTimeout = setTimeout(() => {
          console.log('Auth initialization timeout reached');
          setLoading(false);
          setAuthInitialized(true);
          
          // Force admin role for known admin user
          if (user?.id === ADMIN_USER_ID) {
            setUserRole('admin');
          }
        }, 5000);
        
        // Clean up any stale cached data before initializing
        try {
          // Get all localStorage keys
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            // Find profile/role data older than 24 hours (86400000 ms)
            if (key && (key.startsWith('profile_fetch_time_'))) {
              const timestamp = parseInt(localStorage.getItem(key)) || 0;
              if (Date.now() - timestamp > 86400000) {
                const userId = key.replace('profile_fetch_time_', '');
                console.log('Clearing stale data for user:', userId);
                localStorage.removeItem(`user_profile_${userId}`);
                localStorage.removeItem(`user_role_${userId}`);
                localStorage.removeItem(key);
              }
            }
          }
        } catch (e) {
          console.warn('Error cleaning stale cache:', e);
        }
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session fetch error:', sessionError);
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying auth initialization (${retryCount}/${maxRetries})...`);
            
            // Exponential backoff for retries
            setTimeout(initializeAuth, 1000 * retryCount);
            return;
          }
        }
        
        if (session?.user) {
          setUser(session.user);
          
          // Try to get cached profile immediately for fast UI rendering
          const cachedProfile = getProfileFromLocalStorage(session.user.id);
          if (cachedProfile) {
            setUserProfile(cachedProfile);
            setUserRoleWithPersistence(session.user.id, cachedProfile.role || 'user');
          }
          
          // Fetch fresh profile data (will use cache if available)
          try {
            const profile = await fetchUserProfile(session.user.id);
            
            if (profile) {
              setUserRoleWithPersistence(session.user.id, profile.role || 'user');
              // Store the full profile data for access across components
              setUserProfile(profile);
              console.log('Initial profile data:', profile);
            } else {
              setUserRoleWithPersistence(session.user.id, 'user');
            }
          } catch (profileError) {
            console.error('Profile fetch error:', profileError);
            // Still mark as initialized but with default role
            if (!userRole) {
              setUserRoleWithPersistence(session.user.id, 'user');
            }
          }
        } else {
          // No active session
          setUser(null);
          setUserRole(null);
          setUserProfile(null);
        }
        
        // Auth is now initialized
        setAuthInitialized(true);
      } catch (error) {
        console.error('Auth initialization error:', error);
        
        // Retry logic for critical errors
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying auth initialization after error (${retryCount}/${maxRetries})...`);
          
          // Exponential backoff for retries
          setTimeout(initializeAuth, 1000 * retryCount);
          return;
        } else {
          // After all retries, still mark as initialized but in a clean state
          setUser(null);
          setUserRole(null);
          setUserProfile(null);
          setAuthInitialized(true);
        }
      } finally {
        clearTimeout(authTimeout);
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Auth state change: ${event}`, { 
          hasSession: !!session,
          currentUserId: user?.id,
          newUserId: session?.user?.id
        });
        
        if (event === 'SIGNED_IN' && session?.user) {
          // New sign in
          setUser(session.user);
          
          // Try to use cached profile for immediate update
          const cachedProfile = getProfileFromLocalStorage(session.user.id);
          if (cachedProfile) {
            setUserProfile(cachedProfile);
            setUserRoleWithPersistence(session.user.id, cachedProfile.role || 'user');
          }
          
          // Fetch profile data
          try {
            const profile = await fetchUserProfile(session.user.id);
            if (profile) {
              setUserRoleWithPersistence(session.user.id, profile.role || 'user');
              setUserProfile(profile);
            } else {
              setUserRoleWithPersistence(session.user.id, 'user');
            }
          } catch (error) {
            console.error('Error fetching profile on sign-in:', error);
            // Default to user role if profile fetch fails
            setUserRoleWithPersistence(session.user.id, 'user');
          }
        } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          // User signed out or was deleted
          console.log('User signed out or deleted');
          
          // Clear all state
          setUser(null);
          setUserRole(null);
          setUserProfile(null);
          setOwnerStatus({
            isOwner: false,
            hasPendingRequest: false,
            requestStatus: null,
            rejectionReason: null
          });
          
          // No need to clear localStorage here, that's handled in the logout function
          
        } else if ((event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
          // Token refreshed or user updated
          console.log(`Auth token refreshed or user updated: ${event}`);
          
          // Update user data
          setUser(session.user);
          
          // Only refresh profile if user ID matches or is new
          if (!user || user.id === session.user.id) {
            try {
              const profile = await fetchUserProfile(session.user.id);
              if (profile) {
                setUserRoleWithPersistence(session.user.id, profile.role || 'user');
                setUserProfile(profile);
              }
            } catch (error) {
              console.error('Error refreshing profile on token refresh:', error);
              // Keep existing role/profile on error
            }
          }
        } else if (session?.user && (!user || user.id !== session.user.id)) {
          // Session exists but user state doesn't match - user switched accounts
          console.log('User session change detected');
          setUser(session.user);
          
          // Reset state for new user
          setUserRole(null);
          setUserProfile(null);
          setOwnerStatus({
            isOwner: false,
            hasPendingRequest: false,
            requestStatus: null,
            rejectionReason: null
          });
          
          // Fetch profile data for new user
          try {
            const profile = await fetchUserProfile(session.user.id);
            if (profile) {
              setUserRoleWithPersistence(session.user.id, profile.role || 'user');
              setUserProfile(profile);
            } else {
              setUserRoleWithPersistence(session.user.id, 'user');
            }
          } catch (error) {
            console.error('Error fetching profile for new session:', error);
            setUserRoleWithPersistence(session.user.id, 'user');
          }
        } else if (!session && user) {
          // Session is gone but we still have a user in state
          console.log('Session expired or removed while user state exists');
          
          // Clear user state
          setUser(null);
          setUserRole(null);
          setUserProfile(null);
          setOwnerStatus({
            isOwner: false,
            hasPendingRequest: false,
            requestStatus: null,
            rejectionReason: null
          });
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

  // Set up periodic profile refresh when logged in
  useEffect(() => {
    if (user?.id && authInitialized) {
      console.log('Setting up periodic profile refresh');
      
      // Initial refresh after a short delay
      const initialTimeout = setTimeout(() => {
        refreshProfileInBackground(user.id);
      }, 10000); // 10 seconds after login
      
      // Set up interval for periodic refreshes (every 30 seconds)
      const interval = setInterval(() => {
        console.log('Periodic profile refresh');
        refreshProfileInBackground(user.id);
      }, 30 * 1000); // 30 seconds
      
      return () => {
        clearTimeout(initialTimeout);
        clearInterval(interval);
      };
    }
  }, [user?.id, authInitialized]);

  // Listen for profile updates (like role changes) in realtime
  useEffect(() => {
    if (user?.id && authInitialized) {
      console.log('Setting up profile updates listener');
      
      // Subscribe to profile_updates table for realtime notifications
      const profileUpdatesSubscription = supabase
        .channel('profile_updates_channel')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'profile_updates',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Received profile update notification:', payload);
            
            // Check if it's a role change
            if (payload.new && payload.new.update_type === 'role_change') {
              console.log(`Role changed to: ${payload.new.new_role}`);
              
              // Store the current role before updating
              const previousRole = userRole;
              
              // Immediately refresh the profile
              refreshProfileInBackground(user.id);
              
              // Update the role immediately for a responsive UI
              if (payload.new.new_role) {
                setUserRoleWithPersistence(user.id, payload.new.new_role, previousRole);
              }
            } else {
              // For any other profile update, just refresh the profile
              refreshProfileInBackground(user.id);
            }
          }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(profileUpdatesSubscription);
      };
    }
  }, [user?.id, authInitialized]);

  // Function to clear role change notification
  const clearRoleChangeNotification = () => {
    setRoleChangeNotification(null);
  };

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
    // Role change notification
    roleChangeNotification,
    clearRoleChangeNotification,
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
            
            // IMPORTANT CHANGE: Prioritize the role from the profiles table
            let role = profileData.role || 'user';
            
            // Only override with admin role if specifically set in env var
            if (user.id === ADMIN_USER_ID) {
              role = 'admin';
            } 
            // Only check owner_requests if role is not already set to owner or admin
            else if (role !== 'owner' && role !== 'admin') {
              // Check if user is an owner
              const { data: ownerData } = await supabase
                .from('owner_requests')
                .select('status')
                .eq('user_id', user.id)
                .eq('status', 'approved')
                .maybeSingle();
                
              if (ownerData) {
                role = 'owner';
                
                // Update the profile with owner role if needed
                if (profileData.role !== 'owner') {
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ role: 'owner' })
                    .eq('id', user.id);
                    
                  if (updateError) {
                    console.warn('Failed to update profile with owner role:', updateError);
                  }
                }
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