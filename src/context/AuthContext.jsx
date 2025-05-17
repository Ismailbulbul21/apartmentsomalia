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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [ownerStatus, setOwnerStatus] = useState({
    isOwner: false,
    hasPendingRequest: false,
    requestStatus: null,
    rejectionReason: null
  });

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
    if (user?.id) {
      // Check initially
      checkOwnerStatus();
      
      // Set up interval to check every minute
      const interval = setInterval(checkOwnerStatus, 60000);
      
      return () => clearInterval(interval);
    }
  }, [user]);

  // Function to fetch user profile and role
  const fetchUserProfile = async (userId) => {
    try {
      console.log('Fetching profile for user:', userId);
      
      // Check localStorage first for quick loading
      const cachedRole = getRoleFromLocalStorage(userId);
      if (cachedRole) {
        console.log('Found cached role:', cachedRole);
      }
      
      // Special case for known admin user
      if (userId === ADMIN_USER_ID) {
        console.log('Using hardcoded admin role for known admin user');
        saveRoleToLocalStorage(userId, 'admin');
        return { 
          id: userId,
          role: 'admin', 
          full_name: 'ismail mohamed osman',
          avatar_url: '/images/default-avatar.svg'
        };
      }
      
      try {
        // Try direct SQL query using RPC to bypass RLS
        const { data: directProfile, error: directError } = await supabase.rpc('get_user_profile', {
          user_id: userId
        });
        
        console.log('RPC get_user_profile result:', directProfile, directError);
        
        if (!directError && directProfile && directProfile.length > 0) {
          // Extract the first item from the array
          const profileData = directProfile[0];
          console.log('Extracted profile data:', profileData);
          
          // Process avatar URL if present
          if (profileData.avatar_url) {
            profileData.avatar_url = getProfileImageUrl(profileData.avatar_url);
            console.log('Processed avatar_url from RPC:', profileData.avatar_url);
          }
          
          // Save to localStorage for future use
          if (profileData.role) {
            saveRoleToLocalStorage(userId, profileData.role);
          }
          
          return profileData;
        }
      } catch (rpcErr) {
        // Silent fallback
      }
      
      // Fall back to direct query
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, full_name, avatar_url')
        .eq('id', userId)
        .single();
      
      if (!error && profile) {
        // Process avatar URL if present
        if (profile.avatar_url) {
          profile.avatar_url = getProfileImageUrl(profile.avatar_url);
        }
        
        // Save to localStorage for future use
        if (profile?.role) {
          saveRoleToLocalStorage(userId, profile.role);
        }
        return profile;
      }
      
      // Use admin role as failsafe for known admin user
      if (userId === ADMIN_USER_ID) {
        return { role: 'admin', full_name: 'Admin User' };
      }
      
      // Default fallback
      return { role: 'user', full_name: 'Default User' };
    } catch (err) {
      // Try localStorage as fallback in case of error
      const cachedRole = getRoleFromLocalStorage(userId);
      if (cachedRole) {
        return { role: cachedRole, full_name: 'Cached User' };
      }
      
      // Default to user role as failsafe
      return { role: 'user', full_name: 'Default User' };
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
          
          // Force admin role for known admin user
          if (user?.id === ADMIN_USER_ID) {
            setUserRole('admin');
          }
        }, 3000);
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          
          // Fetch profile data
          const profile = await fetchUserProfile(session.user.id);
          
          if (profile) {
            setUserRoleWithPersistence(session.user.id, profile.role || 'user');
            // Store the full profile data for access across components
            console.log('Initial profile data:', profile);
          } else {
            setUserRoleWithPersistence(session.user.id, 'user');
          }
        } else {
          setUser(null);
          setUserRole(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        clearTimeout(authTimeout);
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          
          // Fetch profile data
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setUserRoleWithPersistence(session.user.id, profile.role || 'user');
          } else {
            setUserRoleWithPersistence(session.user.id, 'user');
          }
        } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          setUser(null);
          setUserRole(null);
        } else if ((event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
          // Always update user data on token refresh
          setUser(session.user);
          
          // Fetch profile data
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setUserRoleWithPersistence(session.user.id, profile.role || 'user');
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

  const value = {
    user,
    userRole,
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
    refreshUserProfile: async () => {
      if (user?.id) {
        const profile = await fetchUserProfile(user.id);
        if (profile) {
          console.log('Manually refreshing role:', profile.role);
          setUserRoleWithPersistence(user.id, profile.role || 'user');
          await checkOwnerStatus();
        }
      }
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
}; 