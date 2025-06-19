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
    // Handle different path formats - paths already include the folder structure
    let normalizedPath = path.trim();
    
    // Remove any leading slashes
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    // Remove bucket name if it's included
    if (normalizedPath.startsWith('apartment_images/')) {
      normalizedPath = normalizedPath.substring('apartment_images/'.length);
    }
    
    // Safety check for empty normalized path after processing
    if (!normalizedPath || normalizedPath === '') {
      return '/images/placeholder-apartment.svg';
    }
    
    const { data } = supabase.storage
      .from('apartment_images')
      .getPublicUrl(normalizedPath);
    
    // Safety check for empty publicUrl
    if (!data || !data.publicUrl) {
      console.warn('Failed to generate public URL for path:', normalizedPath);
      return '/images/placeholder-apartment.svg';
    }
    
    // Cache the result
    imageUrlCache.set(cacheKey, {
      url: data.publicUrl,
      timestamp: Date.now()
    });
    
    return data.publicUrl;
  } catch (error) {
    console.error('Error generating image URL:', error, 'for path:', path);
    return '/images/placeholder-apartment.svg';
  }
};

/**
 * Preload images for better UX
 * @param {string[]} imagePaths - Array of image paths to preload
 */
export const preloadImages = (imagePaths) => {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    return Promise.resolve();
  }
  
  const promises = imagePaths.map(path => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve(); // Still resolve on error to not block other images
      img.src = getImageUrl(path);
    });
  });
  
  return Promise.all(promises);
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