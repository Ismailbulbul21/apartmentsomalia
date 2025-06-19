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
    
    if (normalizedPath.includes('apartment_images/')) {
      normalizedPath = normalizedPath.split('apartment_images/')[1];
    } else if (!normalizedPath.includes('/')) {
      normalizedPath = `apartments/${normalizedPath}`;
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
      return '/images/placeholder-apartment.svg';
    }
    
    // Cache the result
    imageUrlCache.set(cacheKey, {
      url: data.publicUrl,
      timestamp: Date.now()
    });
    
    return data.publicUrl;
  } catch (error) {
    console.error('Error generating image URL:', error, path);
    return '/images/placeholder-apartment.svg';
  }
};

/**
 * Preload images for better performance
 * @param {Array} imagePaths - Array of image paths to preload
 */
export const preloadImages = (imagePaths) => {
  if (!Array.isArray(imagePaths)) return;
  
  imagePaths.forEach(path => {
    if (path && path.trim() !== '') {
      const img = new Image();
      img.src = getImageUrl(path);
    }
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