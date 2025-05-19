import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://evkttwkermhcyizywzpe.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2a3R0d2tlcm1oY3lpenl3enBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MTMzOTAsImV4cCI6MjA2Mjk4OTM5MH0._Dksvs00hB1wr4IyMXAlNTkj3F7khSf1QBAAwurbt1g';

// Cache configuration for better performance
const supabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: {
    fetch: (url, options) => {
      // Set a shorter timeout
      const timeout = 15000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      return fetch(url, {
        ...options,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
    }
  }
};

// Create singleton Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

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