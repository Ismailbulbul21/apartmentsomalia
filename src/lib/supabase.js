import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug log to see if environment variables are loaded correctly
console.log('DEBUG ENV VARS:', { 
  supabaseUrl: supabaseUrl ? 'URL exists (not shown for security)' : 'Missing URL', 
  supabaseAnonKey: supabaseAnonKey ? 'Key exists (not shown for security)' : 'Missing key',
  allEnvVars: import.meta.env 
});

// This helps with debugging when environment variables are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file or Vercel environment variables.');
}

// Cache configuration for better performance
const supabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'supabase-auth-token',
    storage: window.localStorage,
    // Automatically refresh session if it expires
    onAuthStateChange: (event, session) => {
      console.log('Auth state change event:', event);
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        console.log('Session refreshed or signed in');
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        // Clear any cached user data
        localStorage.removeItem('userProfile');
        localStorage.removeItem('userRole');
      }
    }
  },
  global: {
    fetch: (url, options) => {
      // Set a longer timeout for better reliability
      const timeout = 30000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      return fetch(url, {
        ...options,
        signal: controller.signal,
        // Add cache control headers to avoid stale responses
        headers: {
          ...options.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      })
      .then(response => {
        clearTimeout(timeoutId);
        return response;
      })
      .catch(error => {
        clearTimeout(timeoutId);
        console.error('Supabase fetch error:', error);
        // Throw a more descriptive error
        throw new Error(`Connection error: ${error.message}. Please check your internet connection.`);
      });
    }
  },
  // Add better error handling and retry logic
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
};

// Create singleton Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

/**
 * Attempts to recover an expired session
 * @returns {Promise<boolean>} True if session was recovered
 */
export const recoverSession = async () => {
  try {
    // Check if we have a session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Try to refresh the session
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh error:', error.message);
        return false;
      }
      
      if (data.session) {
        console.log('Session successfully refreshed');
        return true;
      }
    } else {
      // We already have a valid session
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Session recovery error:', error);
    return false;
  }
};

// Add event listener for online status to recover connection
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('Network connection restored, recovering session...');
    await recoverSession();
  });
}

/**
 * Helper function to upload an image to storage and create a record in apartment_images
 * @param {File} file - The image file to upload
 * @param {string} apartmentId - The ID of the apartment
 * @param {boolean} isPrimary - Whether this is the primary image
 * @returns {Promise<{success: boolean, filePath: string, error: any}>}
 */
export const uploadApartmentImage = async (file, apartmentId, isPrimary = false) => {
    try {
        if (!file || !apartmentId) {
            console.error('Missing required parameters');
            return { success: false, error: 'Missing required parameters' };
        }

        // Make sure apartmentId is a valid UUID
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apartmentId)) {
            console.error('Invalid apartment ID format:', apartmentId);
            return { success: false, error: 'Invalid apartment ID format' };
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${apartmentId}-${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const filePath = `apartments/${fileName}`;

        // First, check file size and optimize if needed
        if (file.size > 2000000) { // 2MB
            console.warn('Large file detected, consider optimization');
        }

        // Upload the file to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('apartment_images')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return { success: false, error: uploadError };
        }

        // Get the public URL for verification
        const { data } = supabase.storage
            .from('apartment_images')
            .getPublicUrl(filePath);

        // Create image record in the database
        const imageRecord = {
            apartment_id: apartmentId,
            storage_path: filePath,
            is_primary: isPrimary,
            created_at: new Date().toISOString()
        };

        const { data: insertData, error: imageRecordError } = await supabase
            .from('apartment_images')
            .insert(imageRecord)
            .select();

        if (imageRecordError) {
            console.error('Image record insert error:', imageRecordError);
            return { success: false, error: imageRecordError };
        }

        return { success: true, filePath, publicUrl: data.publicUrl };
    } catch (error) {
        console.error('Error in uploadApartmentImage:', error);
        return { success: false, error };
    }
};

/**
 * Helper function to get profile image URL from storage path
 * @param {string} path - The storage path of the image
 * @returns {string} The public URL of the image, or placeholder if not found
 */
export const getProfileImageUrl = (path) => {
    if (!path || path.trim() === '') {
        // Silent failure with default image
        return '/images/default-avatar.svg';
    }

    // If it's already a complete URL
    if (path.startsWith('http://') || path.startsWith('https://')) {
        // Return as-is without logging
        return path;
    }

    try {
        // Handle different path formats
        let normalizedPath = path;

        // If path contains the bucket name, remove it for consistency
        if (path.includes('user_avatars/')) {
            // If the path includes the bucket name already, extract just the path part
            normalizedPath = path.split('user_avatars/')[1];
        }

        // Get the public URL from storage
        const { data } = supabase.storage
            .from('user_avatars')
            .getPublicUrl(normalizedPath);
        
        if (data && data.publicUrl) {
            return data.publicUrl;
        } else {
            // Only log on actual errors, not expected cases
            console.error('Could not generate public URL for path:', path);
            return '/images/default-avatar.svg';
        }
    } catch (error) {
        console.error('Error getting profile image URL:', error);
        return '/images/default-avatar.svg';
    }
}; 