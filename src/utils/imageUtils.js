import { supabase } from '../lib/supabase';

// Cache for image URLs to avoid repeated Supabase calls
const imageUrlCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Centralized function to get image URL from storage path with caching
 * @param {string} path - The storage path of the image
 * @returns {string} The public URL of the image, or placeholder if not found
 */
export const getImageUrl = (path) => {
  // Handle undefined, null, or empty strings
  if (!path || path.trim() === '') {
    return '/images/placeholder-apartment.svg';
  }
  
  // If it's already a complete URL (for demo/sample data)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Check cache first
  const cacheKey = path;
  const cached = imageUrlCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.url;
  }
  
  try {
    // Handle different path formats
    let normalizedPath = path.trim();
    
    // Remove any leading slashes
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    // The paths in database are like "apartments/filename.jpeg"
    // These should be used as-is in the apartment_images bucket
    
    // Safety check for empty normalized path after processing
    if (!normalizedPath || normalizedPath === '') {
      return '/images/placeholder-apartment.svg';
    }
    
    const { data } = supabase.storage
      .from('apartment_images')
      .getPublicUrl(normalizedPath);
    
    // Safety check for empty publicUrl
    if (!data || !data.publicUrl) {
      console.warn('🖼️ Failed to generate public URL for path:', normalizedPath);
      return '/images/placeholder-apartment.svg';
    }
    
    // Cache the result
    imageUrlCache.set(cacheKey, {
      url: data.publicUrl,
      timestamp: Date.now()
    });
    
    console.log('🖼️ Generated URL:', normalizedPath, '→', data.publicUrl);
    return data.publicUrl;
  } catch (error) {
    console.error('🖼️ Error generating image URL:', error, 'for path:', path);
    return '/images/placeholder-apartment.svg';
  }
};

/**
 * Preload images for better UX
 * @param {string[]} imagePaths - Array of image paths to preload
 */
export const preloadImages = (imagePaths) => {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    console.log('🖼️ preloadImages: No images to preload');
    return Promise.resolve();
  }
  
  console.log('🖼️ preloadImages: Starting to preload', imagePaths.length, 'images');
  
  const promises = imagePaths.map(path => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        console.log('🖼️ preloadImages: Successfully preloaded:', path);
        resolve();
      };
      img.onerror = () => {
        console.warn('🖼️ preloadImages: Failed to preload:', path);
        resolve(); // Still resolve on error to not block other images
      };
      img.src = getImageUrl(path);
    });
  });
  
  return Promise.all(promises).then(() => {
    console.log('🖼️ preloadImages: Completed preloading all images');
  });
};

/**
 * Clear image cache (useful for memory management)
 */
export const clearImageCache = () => {
  imageUrlCache.clear();
};

/**
 * Get cache size for debugging
 */
export const getImageCacheSize = () => {
  return imageUrlCache.size;
};

/**
 * Test function to verify image URL generation
 */
export const testImageUrls = () => {
  const testPaths = [
    'apartments/1010ed08-f109-4050-ab26-e5a31a9050d8-1748111578431-704.jpeg',
    'apartments/5c627b60-0358-4ae4-a991-e04ae7156848-1748105138733-363.jpeg'
  ];
  
  console.log('🧪 Testing image URL generation...');
  testPaths.forEach(path => {
    const url = getImageUrl(path);
    console.log(`🧪 Path: ${path} → URL: ${url}`);
  });
};

/**
 * Test direct access to Supabase storage
 */
export const testDirectAccess = async () => {
  const testPath = 'apartments/1010ed08-f109-4050-ab26-e5a31a9050d8-1748111578431-704.jpeg';
  
  console.log('🧪 Testing direct Supabase storage access...');
  
  try {
    // Test getPublicUrl
    const { data: urlData } = supabase.storage
      .from('apartment_images')
      .getPublicUrl(testPath);
    
    console.log('🧪 Generated public URL:', urlData.publicUrl);
    
    // Test if file exists
    const { data: fileData, error: fileError } = await supabase.storage
      .from('apartment_images')
      .download(testPath);
    
    if (fileError) {
      console.error('🧪 File download error:', fileError);
    } else {
      console.log('🧪 File exists and is accessible. Size:', fileData.size, 'bytes');
    }
    
    // Test with fetch
    try {
      const response = await fetch(urlData.publicUrl);
      console.log('🧪 Fetch response status:', response.status);
      console.log('🧪 Fetch response headers:', Object.fromEntries(response.headers.entries()));
    } catch (fetchError) {
      console.error('🧪 Fetch error:', fetchError);
    }
    
  } catch (error) {
    console.error('🧪 Direct access test error:', error);
  }
}; 