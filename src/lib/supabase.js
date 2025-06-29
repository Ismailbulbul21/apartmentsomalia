import { createClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials for testing
const supabaseUrl = 'https://evkttwkermhcyizywzpe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2a3R0d2tlcm1oY3lpenl3enBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MTMzOTAsImV4cCI6MjA2Mjk4OTM5MH0._Dksvs00hB1wr4IyMXAlNTkj3F7khSf1QBAAwurbt1g';

// This helps with debugging when environment variables are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file or deployment environment variables.');
  throw new Error('Missing required Supabase environment variables');
}

// Cache configuration for better performance
const supabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
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
 * Helper function to recover user session
 * @returns {Promise<void>}
 */
export const recoverSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error recovering session:', error);
    }
    return data;
  } catch (error) {
    console.error('Error in recoverSession:', error);
    return null;
  }
};

/**
 * Helper function to upload an image to storage and create a record in apartment_images
 * @param {File} file - The image file to upload
 * @param {string} apartmentId - The ID of the apartment
 * @param {boolean} isPrimary - Whether this is the primary image
 * @returns {Promise<{success: boolean, filePath: string, error: any}>}
 */
export const uploadApartmentImage = async (file, apartmentId, isPrimary = false) => {
    try {
        console.log('uploadApartmentImage called with:', {
            fileName: file?.name,
            fileSize: file?.size,
            apartmentId,
            isPrimary
        });

        if (!file || !apartmentId) {
            const error = 'Missing required parameters';
            console.error('uploadApartmentImage error:', error);
            return { success: false, error };
        }

        // Make sure apartmentId is a valid UUID
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apartmentId)) {
            const error = `Invalid apartment ID format: ${apartmentId}`;
            console.error('uploadApartmentImage error:', error);
            return { success: false, error };
        }

        // Verify apartment exists before uploading
        console.log('Verifying apartment exists:', apartmentId);
        const { data: apartmentCheck, error: apartmentCheckError } = await supabase
            .from('apartments')
            .select('id')
            .eq('id', apartmentId)
            .single();

        if (apartmentCheckError || !apartmentCheck) {
            const error = `Apartment not found: ${apartmentId}`;
            console.error('uploadApartmentImage error:', error, apartmentCheckError);
            return { success: false, error };
        }

        console.log('Apartment verified, proceeding with upload');

        const fileExt = file.name.split('.').pop();
        const fileName = `${apartmentId}-${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const filePath = `apartments/${fileName}`;

        console.log('Generated file path:', filePath);

        // First, check file size and optimize if needed
        if (file.size > 2000000) { // 2MB
            console.warn('Large file detected, size:', file.size);
        }

        // Upload the file to storage
        console.log('Starting storage upload...');
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('apartment_images')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return { success: false, error: uploadError };
        }

        console.log('Storage upload successful:', uploadData);

        // Get the public URL for verification
        const { data: urlData } = supabase.storage
            .from('apartment_images')
            .getPublicUrl(filePath);

        console.log('Generated public URL:', urlData?.publicUrl);

        // Create image record in the database
        const imageRecord = {
            apartment_id: apartmentId,
            storage_path: filePath,
            is_primary: isPrimary,
            created_at: new Date().toISOString()
        };

        console.log('Creating image record:', imageRecord);

        const { data: insertData, error: imageRecordError } = await supabase
            .from('apartment_images')
            .insert(imageRecord)
            .select();

        if (imageRecordError) {
            console.error('Image record insert error:', imageRecordError);
            // Try to clean up the uploaded file
            try {
                await supabase.storage
                    .from('apartment_images')
                    .remove([filePath]);
                console.log('Cleaned up uploaded file after database error');
            } catch (cleanupError) {
                console.error('Failed to cleanup uploaded file:', cleanupError);
            }
            return { success: false, error: imageRecordError };
        }

        console.log('Image record created successfully:', insertData);
        return { success: true, filePath, publicUrl: urlData?.publicUrl, imageRecord: insertData[0] };
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