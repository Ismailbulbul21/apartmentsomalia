import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://evkttwkermhcyizywzpe.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2a3R0d2tlcm1oY3lpenl3enBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MTMzOTAsImV4cCI6MjA2Mjk4OTM5MH0._Dksvs00hB1wr4IyMXAlNTkj3F7khSf1QBAAwurbt1g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper function to upload an image to storage and create a record in apartment_images
 * @param {File} file - The image file to upload
 * @param {string} apartmentId - The ID of the apartment
 * @param {boolean} isPrimary - Whether this is the primary image
 * @returns {Promise<{success: boolean, filePath: string, error: any}>}
 */
export const uploadApartmentImage = async (file, apartmentId, isPrimary = false) => {
    try {
        console.log('Starting upload for apartment:', apartmentId, 'isPrimary:', isPrimary);

        if (!file) {
            console.error('No file provided');
            return { success: false, error: 'No file provided' };
        }

        if (!apartmentId) {
            console.error('No apartment ID provided');
            return { success: false, error: 'No apartment ID provided' };
        }

        // Make sure apartmentId is a valid UUID
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apartmentId)) {
            console.error('Invalid apartment ID format:', apartmentId);
            return { success: false, error: 'Invalid apartment ID format' };
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${apartmentId}-${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const filePath = `apartments/${fileName}`;

        console.log('Uploading to path:', filePath);

        // Upload the file to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('apartment_images')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return { success: false, error: uploadError };
        }

        console.log('Upload successful:', uploadData);

        // Get the public URL for verification
        const { data } = supabase.storage
            .from('apartment_images')
            .getPublicUrl(filePath);

        console.log('Generated public URL:', data.publicUrl);

        // Create image record in the database
        // Note: We're not including the id field, it will be generated automatically
        const imageRecord = {
            apartment_id: apartmentId,
            storage_path: filePath,
            is_primary: isPrimary,
            created_at: new Date().toISOString()
        };

        console.log('Inserting image record:', imageRecord);

        const { data: insertData, error: imageRecordError } = await supabase
            .from('apartment_images')
            .insert(imageRecord)
            .select();

        if (imageRecordError) {
            console.error('Image record insert error:', imageRecordError);
            // Don't delete the file from storage if the insert fails
            return { success: false, error: imageRecordError };
        }

        console.log('Image record inserted successfully:', insertData);
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
    if (!path) {
        return '/images/default-avatar.svg';
    }

    // If it's already a complete URL
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    try {
        // Handle different path formats
        let normalizedPath = path;

        // If path contains the bucket name, remove it for consistency
        if (path.includes('user_avatars/')) {
            normalizedPath = path.split('user_avatars/')[1];
        } else if (!path.includes('/')) {
            // If it's just a filename, assume it's in the avatars folder
            normalizedPath = `avatars/${path}`;
        }

        const { data } = supabase.storage
            .from('user_avatars')
            .getPublicUrl(normalizedPath);

        return data.publicUrl || '/images/default-avatar.svg';
    } catch (error) {
        console.error('Error generating profile image URL:', error, path);
        return '/images/default-avatar.svg';
    }
}; 