# Image Loading Debug Guide

## Current Issue
Images in apartments are not showing properly - they either show as placeholders or load very slowly.

## What We've Fixed So Far

### 1. **Image URL Generation** (`src/utils/imageUtils.js`)
- ✅ Fixed path normalization (removed incorrect `apartment_images/` prefix removal)
- ✅ Added proper caching (5-minute cache)
- ✅ Added comprehensive error handling
- ✅ Added debugging logs

### 2. **Database Verification**
- ✅ Confirmed images exist in storage: `apartment_images` bucket
- ✅ Confirmed bucket is public with correct RLS policies
- ✅ Confirmed image paths in database are correct: `apartments/filename.jpeg`

### 3. **React Components**
- ✅ Simplified LazyImage component with better error handling
- ✅ Added loading states and error fallbacks
- ✅ Simplified apartment card image selection logic

## Expected Image URLs
Based on our database, images should generate URLs like:
```
https://evkttwkermhcyizywzpe.supabase.co/storage/v1/object/public/apartment_images/apartments/1010ed08-f109-4050-ab26-e5a31a9050d8-1748111578431-704.jpeg
```

## Debug Steps

### 1. **Check Console Logs**
When you load the homepage, you should see:
```
🏠 Fetched 2 apartments with images
🖼️ Preloading X images
🏠 Yusra Apartments - Selected image: apartments/... (primary: true)
🏠 Amiira Apartments - Selected image: apartments/... (primary: true)
🖼️ Generated URL: apartments/... → https://...
🖼️ LazyImage processing: apartments/... → https://...
✅ Image loaded successfully: https://...
```

### 2. **Test Direct URLs**
Open the `test-image-url.html` file in your browser to test if the URLs work directly.

### 3. **Visit Test Page**
Go to `/test-images` in your app to see the dedicated image test component.

### 4. **Check Network Tab**
- Open DevTools → Network tab
- Look for image requests
- Check if they're returning 200 OK or error codes
- Check response times

## Potential Issues

### 1. **Network/CORS Issues**
- Images might be blocked by CORS policy
- Network requests might be timing out

### 2. **Supabase Configuration**
- RLS policies might be interfering
- Bucket configuration might have changed

### 3. **React Component Issues**
- Images might be rendering but not visible due to CSS
- Loading states might be stuck

### 4. **Caching Issues**
- Browser cache might have old/broken URLs
- Our cache might have invalid URLs

## Quick Fixes to Try

### 1. **Clear All Caches**
```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
// Then hard refresh (Ctrl+Shift+R)
```

### 2. **Test Direct URL Access**
Open this URL directly in a new tab:
```
https://evkttwkermhcyizywzpe.supabase.co/storage/v1/object/public/apartment_images/apartments/1010ed08-f109-4050-ab26-e5a31a9050d8-1748111578431-704.jpeg
```

### 3. **Check Image Dimensions**
The images might be loading but with 0 dimensions. Check in DevTools if the `<img>` elements have proper width/height.

## Next Steps

1. **Check console logs** when loading the homepage
2. **Test the direct URL** in step 2 above
3. **Visit `/test-images`** page to see dedicated test
4. **Report what you see** in each of these tests

This will help us identify whether the issue is:
- URL generation
- Network/CORS
- React component rendering
- CSS/styling
- Supabase configuration 