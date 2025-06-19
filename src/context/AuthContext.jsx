import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, getProfileImageUrl } from '../lib/supabase';
import { logAuthState, getOAuthErrorInfo, diagnoseAuthIssue } from '../utils/authDebug';

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

  // Function to create a profile for OAuth users
  const createProfileForOAuthUser = async (user) => {
    try {
      console.log('Creating profile for OAuth user:', user.id);
      console.log('User metadata:', user.user_metadata);
      console.log('App metadata:', user.app_metadata);
      
      // Extract user data from OAuth provider
      const userData = user.user_metadata || {};
      const fullName = userData.full_name || userData.name || 'User';
      const avatarUrl = userData.avatar_url || userData.picture || null;
      
      console.log('Extracted data:', {
        fullName,
        avatarUrl,
        userDataKeys: Object.keys(userData)
      });
      
      const profileToInsert = {
        id: user.id,
        full_name: fullName,
        avatar_url: avatarUrl,
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('Profile to insert:', profileToInsert);
      
      // Create profile in database
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert(profileToInsert)
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating OAuth user profile:', createError);
        console.log('Create error details:', {
          code: createError.code,
          message: createError.message,
          details: createError.details
        });
        
        // Return a default profile even if database insert fails
        const fallbackProfile = {
          id: user.id,
          full_name: fullName,
          avatar_url: processAvatarUrl(avatarUrl),
          role: 'user',
          created_at: new Date().toISOString()
        };
        console.log('Returning fallback profile:', fallbackProfile);
        return fallbackProfile;
      }
      
      // Process avatar URL
      newProfile.avatar_url = processAvatarUrl(newProfile.avatar_url);
      
      console.log('Successfully created profile for OAuth user:', newProfile);
      return newProfile;
    } catch (error) {
      console.error('Error in createProfileForOAuthUser:', error);
      // Return a minimal profile as fallback
      const minimalProfile = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
        avatar_url: processAvatarUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture),
        role: 'user',
        created_at: new Date().toISOString()
      };
      console.log('Returning minimal profile:', minimalProfile);
      return minimalProfile;
    }
  };

  // Function to fetch user profile and role
  const fetchUserProfile = async (userId, retryAttempt = 0) => {
    const maxRetries = 2;
    
    try {
      // Check localStorage first for quick loading
      const cachedRole = getRoleFromLocalStorage(userId);
      const cachedProfile = getProfileFromLocalStorage(userId);
      const lastFetchTime = getProfileFetchTime(userId);
      const profileCacheTTL = 10 * 60 * 1000; // Increased to 10 minutes for better performance
      
      // Use cached profile if it exists and is fresh
      if (cachedProfile && Date.now() - lastFetchTime < profileCacheTTL) {
        setUserProfile(cachedProfile);
        setUserRoleWithPersistence(userId, cachedProfile.role || 'user');
        return cachedProfile;
      }
      
      // Special case for admin user
      if (ADMIN_USER_ID && userId === ADMIN_USER_ID) {
        if (cachedRole === 'admin' && cachedProfile) {
          return cachedProfile;
        }
        
        const { data: adminProfile, error: adminProfileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (!adminProfileError && adminProfile) {
          adminProfile.avatar_url = processAvatarUrl(adminProfile.avatar_url);
          const profileWithRole = { ...adminProfile, role: 'admin' };
          saveProfileToLocalStorage(userId, profileWithRole);
          return profileWithRole;
        }
      }
      
      // Fetch profile from database
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        // Handle profile not found for OAuth users
        if (profileError.code === 'PGRST116' || profileError.message.includes('No rows returned')) {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          
          if (currentUser && currentUser.id === userId) {
            const provider = currentUser.app_metadata?.provider;
            const isOAuthUser = provider && provider !== 'email';
            
            if (isOAuthUser) {
              try {
                const newProfile = await createProfileForOAuthUser(currentUser);
                saveProfileToLocalStorage(userId, newProfile);
                return newProfile;
              } catch (createError) {
                console.error('Error creating OAuth profile:', createError);
                return {
                  id: userId,
                  full_name: currentUser.user_metadata?.full_name || 'User',
                  avatar_url: processAvatarUrl(currentUser.user_metadata?.avatar_url),
                  role: 'user',
                  created_at: new Date().toISOString()
                };
              }
            }
          }
        }
        
        // Retry logic
        if (retryAttempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchUserProfile(userId, retryAttempt + 1);
        }
        
        // Fallback to cached data or default
        return cachedProfile || {
          id: userId,
          role: cachedRole || 'user',
          created_at: new Date().toISOString()
        };
      }
      
      // Process successful profile data
      if (profileData) {
        profileData.avatar_url = processAvatarUrl(profileData.avatar_url);
        
        // Determine role
        let userRole = profileData.role || 'user';
        if (ADMIN_USER_ID && userId === ADMIN_USER_ID) {
          userRole = 'admin';
        }
        
        const finalProfile = { ...profileData, role: userRole };
        
        // Save to localStorage and state
        saveProfileToLocalStorage(userId, finalProfile);
        setUserProfile(finalProfile);
        setUserRoleWithPersistence(userId, userRole, cachedRole);
        
        return finalProfile;
      }
      
      // Fallback
      return cachedProfile || {
        id: userId,
        role: 'user',
        created_at: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Unexpected error in fetchUserProfile:', error);
      
      // Return cached data if available
      const cachedProfile = getProfileFromLocalStorage(userId);
      if (cachedProfile) {
        return cachedProfile;
      }
      
      // Final fallback
      return {
        id: userId,
        role: getRoleFromLocalStorage(userId) || 'user',
        created_at: new Date().toISOString()
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
          
          // For OAuth users, add a small delay to ensure authentication is fully established
          const isOAuthUser = session.user.app_metadata?.provider && session.user.app_metadata.provider !== 'email';
          const delay = isOAuthUser ? 1000 : 0; // 1 second delay for OAuth users
          
          console.log('Sign-in detected:', {
            id: session.user.id,
            isOAuth: isOAuthUser,
            provider: session.user.app_metadata?.provider,
            delayBeforeProfileFetch: delay
          });
          
          // Fetch profile data with delay for OAuth users
          setTimeout(async () => {
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
          }, delay);
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
          
          // For OAuth users, add a small delay to ensure authentication is fully established
          const isOAuthUser = session.user.app_metadata?.provider && session.user.app_metadata.provider !== 'email';
          const delay = isOAuthUser ? 1000 : 0; // 1 second delay for OAuth users
          
          console.log('Sign-in detected:', {
            id: session.user.id,
            isOAuth: isOAuthUser,
            provider: session.user.app_metadata?.provider,
            delayBeforeProfileFetch: delay
          });
          
          // Fetch profile data with delay for OAuth users
          setTimeout(async () => {
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
          }, delay);
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

  // Google Sign-in function with improved error handling
  const signInWithGoogle = async () => {
    try {
      logAuthState('Google Sign-in Started');
      
      // Check if we're already in the middle of an OAuth flow
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('code') || urlParams.get('error')) {
        logAuthState('OAuth flow already in progress', { urlParams: Object.fromEntries(urlParams) });
        return { success: false, error: 'Authentication already in progress' };
      }
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
      
      if (error) {
        logAuthState('Google OAuth initiation error', { error });
        throw error;
      }
      
      logAuthState('Google OAuth initiated successfully', { data });
      return { success: true, data };
    } catch (error) {
      logAuthState('Google sign-in error', { error: error.message });
      return { success: false, error: error.message };
    }
  };

  // Handle OAuth callback with improved error handling and timeout
  const handleAuthCallback = async () => {
    try {
      logAuthState('Processing auth callback');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Authentication timeout')), 30000); // 30 seconds timeout
      });
      
      // Check URL for OAuth errors first
      const urlParams = new URLSearchParams(window.location.search);
      const oauthError = urlParams.get('error');
      const oauthErrorDescription = urlParams.get('error_description');
      
      if (oauthError) {
        const friendlyError = getOAuthErrorInfo(oauthError);
        logAuthState('OAuth error in URL', { 
          error: oauthError, 
          description: oauthErrorDescription,
          friendlyError 
        });
        return { 
          success: false, 
          error: friendlyError || oauthErrorDescription || 'Authentication failed' 
        };
      }
      
      // Get session with timeout
      const sessionPromise = supabase.auth.getSession();
      const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);
      
      if (error) {
        logAuthState('Session retrieval error', { error });
        throw error;
      }
      
      if (data.session) {
        logAuthState('Session found, authentication successful', { 
          userId: data.session.user?.id,
          expiresAt: data.session.expires_at 
        });
        
        // Verify the session is valid and not expired
        const expiresAt = data.session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        
        if (expiresAt && expiresAt < now) {
          logAuthState('Session is expired', { expiresAt, now });
          return { success: false, error: 'Session expired' };
        }
        
        // Clear any OAuth parameters from URL
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        return { success: true, session: data.session };
      }
      
      // If no session but no error, try to handle edge cases
      logAuthState('No session found, checking for pending authentication');
      
      // Wait a bit and try again (sometimes there's a delay)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { data: retryData, error: retryError } = await supabase.auth.getSession();
      
      if (retryError) {
        logAuthState('Retry session retrieval error', { error: retryError });
        throw retryError;
      }
      
      if (retryData.session) {
        logAuthState('Session found on retry');
        return { success: true, session: retryData.session };
      }
      
      logAuthState('No session found after retry - generating diagnosis', diagnoseAuthIssue());
      return { success: false, error: 'No session found - authentication may have been cancelled' };
      
    } catch (error) {
      logAuthState('Auth callback error', { error: error.message, diagnosis: diagnoseAuthIssue() });
      
      // Handle specific error types
      if (error.message === 'Authentication timeout') {
        return { success: false, error: 'Authentication timed out. Please try again.' };
      }
      
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
    signInWithGoogle,
    handleAuthCallback,
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
            
            // Check if this is a "not found" error (profile doesn't exist)
            if (profileError.code === 'PGRST116' || profileError.message.includes('No rows returned')) {
              console.log('Profile not found, checking if this is an OAuth user');
              
              // Get the current user to check if they're an OAuth user
              const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
              
              if (userError) {
                console.error('Error getting current user:', userError);
              } else {
                console.log('Current user data:', {
                  id: currentUser?.id,
                  email: currentUser?.email,
                  app_metadata: currentUser?.app_metadata,
                  user_metadata: currentUser?.user_metadata
                });
              }
              
              if (currentUser && currentUser.id === user.id) {
                // Check if this user signed up via OAuth (has provider data)
                const provider = currentUser.app_metadata?.provider;
                const isOAuthUser = provider && provider !== 'email';
                
                console.log('OAuth detection:', {
                  provider,
                  isOAuthUser,
                  hasUserMetadata: !!currentUser.user_metadata,
                  userMetadataKeys: Object.keys(currentUser.user_metadata || {})
                });
                
                if (isOAuthUser) {
                  console.log('OAuth user detected, creating profile');
                  try {
                    const newProfile = await createProfileForOAuthUser(currentUser);
                    console.log('Profile creation result:', newProfile);
                    
                    // Save to localStorage
                    saveProfileToLocalStorage(user.id, newProfile);
                    
                    return newProfile;
                  } catch (createError) {
                    console.error('Error creating OAuth profile:', createError);
                    // Return a basic profile even if creation fails
                    return {
                      id: user.id,
                      full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || 'User',
                      avatar_url: processAvatarUrl(currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture),
                      role: 'user',
                      created_at: new Date().toISOString()
                    };
                  }
                } else {
                  console.log('Not an OAuth user, provider:', provider);
                }
              } else {
                console.log('User ID mismatch or no current user');
              }
            } else {
              console.log('Profile error is not a "not found" error');
            }
          }
          
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