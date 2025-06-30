import { supabase } from '../lib/supabase';

// Enhanced cache for image URLs with better performance
const imageUrlCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - longer cache for better performance
const MAX_CACHE_SIZE = 1000; // Prevent memory leaks

/**
 * Centralized function to get image URL from storage path with caching and optimization
 * @param {string} path - The storage path of the image
 * @param {Object} options - Optional parameters for image optimization
 * @param {number} options.width - Desired width for optimization
 * @param {number} options.height - Desired height for optimization
 * @param {string} options.quality - Image quality (low, medium, high)
 * @returns {string} The public URL of the image, or placeholder if not found
 */
export const getImageUrl = (path, options = {}) => {
  // Handle undefined, null, or empty strings
  if (!path || path.trim() === '') {
    console.log('🖼️ Empty path provided, returning placeholder');
    return '/images/placeholder-apartment.svg';
  }
  
  // If it's already a complete URL (for demo/sample data)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    console.log('🖼️ Complete URL provided:', path);
    return path;
  }
  
  // Create cache key including options
  const cacheKey = `${path}_${JSON.stringify(options)}`;
  const cached = imageUrlCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log('🖼️ Cache hit for:', path);
    return cached.url;
  }
  
  // Clean cache if it gets too large
  if (imageUrlCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(imageUrlCache.entries());
    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    entries.slice(0, toRemove).forEach(([key]) => imageUrlCache.delete(key));
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
      console.warn('🖼️ Normalized path is empty for:', path);
      return '/images/placeholder-apartment.svg';
    }
    
    console.log('🖼️ Generating URL for path:', normalizedPath);
    
    const { data } = supabase.storage
      .from('apartment_images')
      .getPublicUrl(normalizedPath);
    
    // Safety check for empty publicUrl
    if (!data || !data.publicUrl) {
      console.error('🖼️ Failed to generate public URL for path:', normalizedPath);
      return '/images/placeholder-apartment.svg';
    }
    
    let finalUrl = data.publicUrl;
    
    // Add optimization parameters if supported (Supabase doesn't support transform yet, but ready for future)
    if (options.width || options.height || options.quality) {
      const urlObj = new URL(finalUrl);
      if (options.width) urlObj.searchParams.set('width', options.width);
      if (options.height) urlObj.searchParams.set('height', options.height);
      if (options.quality) urlObj.searchParams.set('quality', options.quality);
      finalUrl = urlObj.toString();
    }
    
    // Cache the result
    imageUrlCache.set(cacheKey, {
      url: finalUrl,
      timestamp: Date.now()
    });
    
    console.log('🖼️ Generated URL:', finalUrl);
    return finalUrl;
  } catch (error) {
    console.error('🖼️ Error generating image URL:', error, 'for path:', path);
    return '/images/placeholder-apartment.svg';
  }
};

/**
 * Fast preload images with priority and batching
 * @param {string[]} imagePaths - Array of image paths to preload
 * @param {Object} options - Preload options
 * @param {number} options.batchSize - Number of images to preload at once
 * @param {number} options.delay - Delay between batches in ms
 */
export const preloadImages = (imagePaths, options = {}) => {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    return Promise.resolve();
  }
  
  const { batchSize = 3, delay = 100 } = options;
  
  console.log('🖼️ Fast preloading', imagePaths.length, 'images in batches of', batchSize);
  
  const preloadBatch = (paths) => {
    return Promise.all(
      paths.map(path => {
    return new Promise((resolve) => {
      const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
      img.src = getImageUrl(path);
    });
      })
    );
  };
  
  const processBatches = async () => {
    for (let i = 0; i < imagePaths.length; i += batchSize) {
      const batch = imagePaths.slice(i, i + batchSize);
      await preloadBatch(batch);
      
      // Small delay between batches to not overwhelm the browser
      if (i + batchSize < imagePaths.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };
  
  return processBatches();
};

/**
 * Create an intersection observer for lazy loading images
 * @param {Function} callback - Function to call when element is visible
 * @param {Object} options - Observer options
 */
export const createImageObserver = (callback, options = {}) => {
  const defaultOptions = {
    root: null,
    rootMargin: '50px', // Start loading 50px before element is visible
    threshold: 0.1
  };
  
  if ('IntersectionObserver' in window) {
    return new IntersectionObserver(callback, { ...defaultOptions, ...options });
  }
  
  // Fallback for browsers without IntersectionObserver
  return {
    observe: () => {},
    unobserve: () => {},
    disconnect: () => {}
  };
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
export const testImageGeneration = () => {
  const testPaths = [
    'apartments/1010ed08-f109-4050-ab26-e5a31a9050d8-1748111578431-704.jpeg',
    'apartments/5c627b60-0358-4ae4-a991-e04ae7156848-1748105138733-363.jpeg'
  ];
  
  console.log('🧪 Testing image URL generation...');
  testPaths.forEach(path => {
    const url = getImageUrl(path);
    console.log(`🧪 Path: ${path} → URL: ${url}`);
    
    // Test if the URL is accessible
    const img = new Image();
    img.onload = () => console.log(`✅ Image loaded successfully: ${path}`);
    img.onerror = () => console.error(`❌ Failed to load image: ${path} from URL: ${url}`);
    img.src = url;
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

/**
 * Test direct access to image URLs - useful for debugging production issues
 */
export const testImageUrls = async () => {
  const testPaths = [
    'apartments/1010ed08-f109-4050-ab26-e5a31a9050d8-1748111578431-704.jpeg',
    'apartments/5c627b60-0358-4ae4-a991-e04ae7156848-1748105138733-363.jpeg'
  ];
  
  console.log('🧪 DEBUG: Testing apartment image URLs directly...');
  
  for (const path of testPaths) {
    const url = getImageUrl(path);
    console.log(`🧪 Testing: ${path} → ${url}`);
    
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        console.log(`✅ DIRECT TEST SUCCESS: ${path}`);
      } else {
        console.error(`❌ DIRECT TEST FAILED: ${path} - Status: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ DIRECT TEST ERROR: ${path} - Error:`, error.message);
    }
  }
}; 