import { useState, useEffect, useCallback, memo, Suspense, lazy, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Link } from 'react-router-dom';
import { getImageUrl, preloadImages, testImageUrls } from '../utils/imageUtils';
import { measureAsync } from '../utils/performance';

// Lazy-loaded image component with placeholder
const LazyImage = memo(({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  
  useEffect(() => {
    // Process the src to get the correct URL or a placeholder
    if (!src || src.trim() === '') {
      setImageSrc('/images/placeholder-apartment.svg');
    } else {
      const processedSrc = getImageUrl(src);
      setImageSrc(processedSrc);
      console.log('🖼️ LazyImage processing:', src, '→', processedSrc);
    }
  }, [src]);
  
  const handleLoad = () => {
    console.log('✅ Image loaded successfully:', imageSrc);
    setIsLoaded(true);
  };
  
  const handleError = (e) => {
    console.error('❌ Image failed to load:', imageSrc);
    setError(true);
  };
  
  // Return early with placeholder if no valid source
  if (!imageSrc) {
    return (
      <div className={`${className} relative overflow-hidden bg-night-800`}>
        <img 
          src="/images/placeholder-apartment.svg" 
          alt="Placeholder" 
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  
  return (
    <div className={`${className} relative overflow-hidden bg-night-800`}>
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-night-800">
          <div className="w-8 h-8 border-4 border-primary-300 border-t-primary-600 rounded-full animate-spin"></div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-night-800">
          <img 
            src="/images/placeholder-apartment.svg" 
            alt="Placeholder" 
            className="w-full h-full object-cover opacity-50"
          />
        </div>
      )}
      
      <img 
        src={imageSrc}
        alt={alt || "Apartment image"}
        className={`w-full h-full object-cover transition-all duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  );
});

// Apartment card component
const ApartmentCard = memo(({ apartment }) => {
  if (!apartment) {
    console.error('Apartment is null or undefined in ApartmentCard');
    return null;
  }
  
  // Check if any floors are available
  const hasAvailableFloors = () => {
    if (!apartment.apartment_floors || !Array.isArray(apartment.apartment_floors)) {
      // If no floor data, fall back to apartment.is_available
      return apartment.is_available;
    }
    
    // Check if any floor has status 'available'
    return apartment.apartment_floors.some(floor => floor.floor_status === 'available');
  };
  
  const isApartmentAvailable = hasAvailableFloors();
  
  // Get the image to display - simplified logic
  let imageToShow = null;
  
  if (apartment.apartment_images && Array.isArray(apartment.apartment_images) && apartment.apartment_images.length > 0) {
    // First try to find primary image
    const primaryImage = apartment.apartment_images.find(img => img && img.is_primary && img.storage_path);
    // Otherwise use first image
    const firstImage = apartment.apartment_images.find(img => img && img.storage_path);
    
    imageToShow = primaryImage || firstImage;
    
    console.log(`🏠 ${apartment.title} - Selected image:`, imageToShow?.storage_path, '(primary:', !!primaryImage, ')');
  }
  
  const imagePath = imageToShow?.storage_path || '/images/placeholder-apartment.svg';
  
  return (
    <motion.div 
      className={`modern-card text-white shadow-lg border overflow-hidden rounded-xl bg-night-900 border-night-700 hover:shadow-xl`}
      whileHover={{ y: -5, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative">
        <Link to={`/apartments/${apartment.id}`} className="block">
          <LazyImage 
            src={imagePath} 
            alt={apartment.title}
            className="h-48 w-full"
          />
        </Link>
        
        <div className="absolute top-0 right-0 m-3">
          <span className="bg-primary-500 text-white text-xs font-bold px-2.5 py-1 rounded-md">
            ${apartment.price_per_month}/bishii
          </span>
        </div>
        {apartment.district && (
          <div className="absolute bottom-0 left-0 m-3">
            <span className="bg-night-800 bg-opacity-80 text-white text-xs px-2 py-1 rounded-md">
              {apartment.district}
            </span>
          </div>
        )}
      </div>
      
      <div className="p-5">
        <Link to={`/apartments/${apartment.id}`} className="block">
          <h3 className="text-lg font-semibold line-clamp-1 mb-2 text-white">
            {apartment.title}
          </h3>
          <p className="text-sm mb-4 line-clamp-2 text-night-300">
            {apartment.location_description}
          </p>
        </Link>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3 text-xs text-night-300">
            <div className="flex items-center px-2 py-1 rounded-md bg-night-800">
              <svg className="w-4 h-4 mr-1 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>{apartment.rooms}</span>
            </div>
            <div className="flex items-center px-2 py-1 rounded-md bg-night-800">
              {/* Toilet/Restroom icon for bathrooms */}
              <svg className="w-4 h-4 mr-1 text-primary-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 2v1h6V2a1 1 0 0 1 2 0v1h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v10a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V8H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1V2a1 1 0 0 1 2 0zm0 6v10a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V8H9zm8-2V5H7v1h10z"/>
                <circle cx="12" cy="14" r="1"/>
              </svg>
              <span>{apartment.bathrooms}</span>
            </div>
            {apartment.is_furnished && (
              <div className="flex items-center px-2 py-1 rounded-md bg-night-800">
                <svg className="w-4 h-4 mr-1 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span>Fadhiisan</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Owner name - Show custom name if set, otherwise show profile name */}
        {(apartment.display_owner_name || (apartment.owner && apartment.owner.full_name)) && (
          <div className="mt-3 flex items-center text-xs text-night-400">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span>Milkiile: {apartment.display_owner_name || apartment.owner.full_name}</span>
          </div>
        )}
        
        {/* Availability Status Badge */}
        <div className="mt-3">
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
            isApartmentAvailable 
              ? 'bg-green-900 text-green-200 border border-green-700' 
              : 'bg-red-900 text-red-200 border border-red-700'
          }`}>
            {isApartmentAvailable ? (
              <>
                <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Waa la heli karaa
              </>
            ) : (
              <>
                <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Lama heli karo
              </>
            )}
          </span>
        </div>
        
        {/* Contact Section - Always show for all apartments */}
        {(apartment.whatsapp_number || (apartment.owner && apartment.owner.whatsapp_number)) && (
          <div className="mt-3 flex justify-end">
            <a 
              href={`https://wa.me/${(apartment.whatsapp_number || apartment.owner.whatsapp_number).replace(/\D/g, '')}?text=Halo, Waan ku xiiseynayaa gurigaaga: ${apartment.title}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center transition-colors ${
                isApartmentAvailable 
                  ? 'text-green-400 hover:text-green-300' 
                  : 'text-green-500 hover:text-green-400'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                window.open(`https://wa.me/${(apartment.whatsapp_number || apartment.owner.whatsapp_number).replace(/\D/g, '')}?text=Halo, Waan ku xiiseynayaa gurigaaga: ${apartment.title}`, '_blank');
              }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default function Home() {
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  

  
  // Filter states
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRooms, setMinRooms] = useState('');
  const [isFurnished, setIsFurnished] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  
  // Mogadishu districts
  const districts = [
    "Abdiaziz",
    "Bondhere",
    "Daynile",
    "Dharkenley",
    "Hamar Jajab",
    "Hamar Weyne",
    "Hodan",
    "Howl Wadaag",
    "Huriwa",
    "Karan",
    "Shangani",
    "Shibis",
    "Waberi",
    "Wadajir",
    "Warta Nabada",
    "Yaqshid"
  ];
  
  // Memoized fetch function with optimization and performance monitoring
  const fetchApartments = useCallback(async () => {
    await measureAsync('apartments-fetch', async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Build optimized query with proper indexing
        let query = supabase
          .from('apartments')
          .select(`
            id,
            title,
            description,
            location_description,
            district,
            rooms,
            bathrooms,
            price_per_month,
            is_furnished,
            is_available,
            created_at,
            primary_image_path,
            owner_id,
            whatsapp_number,
            display_owner_name,
            apartment_images(storage_path, is_primary),
            apartment_floors(floor_status)
          `)
          .eq('status', 'approved');
        
        // Apply filters efficiently using indexes
        if (selectedDistrict) {
          query = query.eq('district', selectedDistrict);
        }
        
        if (minPrice) {
          query = query.gte('price_per_month', parseInt(minPrice));
        }
        
        if (maxPrice) {
          query = query.lte('price_per_month', parseInt(maxPrice));
        }
        
        if (minRooms) {
          query = query.gte('rooms', parseInt(minRooms));
        }
        
        if (isFurnished !== '') {
          query = query.eq('is_furnished', isFurnished === 'true');
        }
        
        // Limit results for better performance and add ordering
        const { data: apartmentData, error: apartmentError } = await query
          .order('created_at', { ascending: false })
          .limit(50); // Limit to 50 apartments for better performance
        
        if (apartmentError) throw apartmentError;
        
        if (apartmentData && apartmentData.length > 0) {
          console.log('🏠 Fetched', apartmentData.length, 'apartments with images');
          
          // Get unique owner IDs and fetch profiles in one query
          const ownerIds = [...new Set(apartmentData.map(apt => apt.owner_id))];
          
          const { data: profilesData } = await measureAsync('owner-profiles-fetch', () =>
            supabase
              .from('profiles')
              .select('id, full_name, whatsapp_number')
              .in('id', ownerIds)
          );
          
          // Create owner map for quick lookup
          const ownerMap = (profilesData || []).reduce((map, profile) => {
            map[profile.id] = profile;
            return map;
          }, {});
          
          // Enrich apartment data
          const enrichedData = apartmentData.map(apt => ({
            ...apt,
            owner: ownerMap[apt.owner_id] || null
          }));
          
          // Preload images for better UX
          const imagePaths = enrichedData
            .flatMap(apt => apt.apartment_images || [])
            .map(img => img.storage_path)
            .filter(Boolean);
          
          if (imagePaths.length > 0) {
            console.log('🖼️ Preloading', imagePaths.length, 'images');
            measureAsync('image-preload', () => preloadImages(imagePaths));
          }
          
          setApartments(enrichedData);
        } else {
          setApartments([]);
        }
      } catch (error) {
        console.error('Error fetching apartments:', error);
        setError('Failed to load apartments. Please try again later.');
        setApartments([]);
      } finally {
        setLoading(false);
      }
    });
  }, [minPrice, maxPrice, minRooms, isFurnished, selectedDistrict]);

  // Fetch apartments on component mount and when filters change
  useEffect(() => {
    // Immediate fetch on component mount
    if (selectedDistrict) {
      fetchApartments();
    } else {
      // Default fetch for initial load or when clearing district filter
      fetchApartments();
    }
  }, [selectedDistrict, fetchApartments]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchApartments();
  };

  const resetFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setMinRooms('');
    setIsFurnished('');
    setSelectedDistrict('');
    
    // If we're already in the apartments section, scroll to it
    // to show the reset results
    if (apartmentsSectionRef.current) {
      apartmentsSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
    
    // Set loading to true temporarily to show the loading indicator
    setLoading(true);
  };

  // Create a ref for the apartments section
  const apartmentsSectionRef = useRef(null);
  
  const handleDistrictChange = (district) => {
    setSelectedDistrict(district);
    // Set apartment loading state to true to show loading spinner
    setLoading(true);
    
    // The useEffect will handle fetching apartments
    
    // After a small delay to allow state to update, scroll to the apartments section
    setTimeout(() => {
      if (apartmentsSectionRef.current) {
        apartmentsSectionRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Compact Header with Districts and Filters */}
      <section className="relative text-white">
        <div className="container mx-auto px-4 py-4">
          {/* Districts Section - Very Compact */}
          <div className="mb-4">
            {/* Small title above districts */}
            <h2 className="text-lg font-semibold text-white mb-3 text-center">📍 Degmooyinka Muqdisho</h2>
            
            {/* Mobile dropdown */}
            <div className="block md:hidden mb-3">
              <div className="relative">
                <select
                  value={selectedDistrict}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-medium"
                >
                  <option value="">🏙️ Dhammaan Degmooyinka</option>
                  {districts.map(district => (
                    <option key={district} value={district}>📍 {district}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {selectedDistrict && (
                <div className="mt-2 flex justify-center">
                  <button
                    onClick={resetFilters}
                    className="flex items-center space-x-1 text-xs text-blue-400 bg-gray-800 px-3 py-1 rounded-full border border-gray-600 hover:bg-gray-700 transition-colors"
                  >
                    <span>Tirtir "{selectedDistrict}"</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            
            {/* District chips for desktop - More compact */}
            <div className="hidden md:block">
              <div className="grid grid-cols-8 gap-2 mb-3">
                <motion.div
                  onClick={() => handleDistrictChange('')}
                  className={`cursor-pointer rounded-lg p-2 text-center transition-all ${
                    selectedDistrict === '' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="text-lg mb-1">🏙️</div>
                  <span className="text-xs font-medium">Dhamaan</span>
                </motion.div>
                
                {districts.slice(0, 7).map(district => (
                  <motion.div
                    key={district}
                    onClick={() => handleDistrictChange(district)}
                    className={`cursor-pointer rounded-lg p-2 text-center transition-all ${
                      selectedDistrict === district 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="text-lg mb-1">📍</div>
                    <span className="text-xs font-medium">{district}</span>
                  </motion.div>
                ))}
              </div>
              
              <div className="grid grid-cols-8 gap-2">
                {districts.slice(7).map(district => (
                  <motion.div
                    key={district}
                    onClick={() => handleDistrictChange(district)}
                    className={`cursor-pointer rounded-lg p-2 text-center transition-all ${
                      selectedDistrict === district 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="text-lg mb-1">📍</div>
                    <span className="text-xs font-medium">{district}</span>
                  </motion.div>
                ))}
                {/* Fill remaining slots with empty divs for proper grid alignment */}
                {Array.from({ length: 8 - districts.slice(7).length }).map((_, index) => (
                  <div key={`empty-${index}`}></div>
                ))}
              </div>
            </div>
          </div>

          {/* Very Compact Filter Panel */}
          <motion.div 
            className="bg-gray-800/90 backdrop-blur-md p-3 rounded-xl border border-gray-700 shadow-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <form onSubmit={handleFilterSubmit} className="space-y-3">
              {/* Filter controls - Now as dropdowns */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium">Qiimaha Ugu Yar</label>
                  <select
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-medium"
                  >
                    <option value="">Dhamaan</option>
                    <option value="100">$100+</option>
                    <option value="200">$200+</option>
                    <option value="300">$300+</option>
                    <option value="400">$400+</option>
                    <option value="500">$500+</option>
                    <option value="750">$750+</option>
                    <option value="1000">$1000+</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium">Qiimaha Ugu Badan</label>
                  <select
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-medium"
                  >
                    <option value="">Dhamaan</option>
                    <option value="300">$300</option>
                    <option value="500">$500</option>
                    <option value="750">$750</option>
                    <option value="1000">$1000</option>
                    <option value="1500">$1500</option>
                    <option value="2000">$2000</option>
                    <option value="3000">$3000+</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium">Qolalka Jiifka</label>
                  <select
                    value={minRooms}
                    onChange={(e) => setMinRooms(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-medium"
                  >
                    <option value="">Dhamaan</option>
                    <option value="1">1+ qol</option>
                    <option value="2">2+ qol</option>
                    <option value="3">3+ qol</option>
                    <option value="4">4+ qol</option>
                    <option value="5">5+ qol</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium">Alaab Guriga</label>
                  <select
                    value={isFurnished}
                    onChange={(e) => setIsFurnished(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-medium"
                  >
                    <option value="">Dhamaan</option>
                    <option value="true">Haa</option>
                    <option value="false">Maya</option>
                  </select>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2 flex-1 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Raadi</span>
                </button>
                
                {(minPrice || maxPrice || minRooms || isFurnished || selectedDistrict) && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Tirtir</span>
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      </section>
      
      {/* Apartments Section - Immediately Visible */}
      <section ref={apartmentsSectionRef} className="py-4">
        <div className="container mx-auto px-4">
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white mb-1">
                  {selectedDistrict ? `🏠 Guryaha ${selectedDistrict}` : '🏠 Guryaha La Heli Karo'}
                </h1>
                <p className="text-gray-400 text-sm">
                  {loading ? 'Waa la soo raraya...' : 
                   apartments.length > 0 ? `${apartments.length} guri la helay` : 
                   'Raadi gurigaaga ku haboon'}
                </p>
              </div>
              
              {selectedDistrict && (
                <button 
                  onClick={resetFilters}
                  className="flex items-center bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <span>Tirtir filtarka</span>
                  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-3 text-gray-400 text-sm">Waa la soo raraya guryaha...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-700 text-red-200 p-4 rounded-xl text-center">
              <div className="text-3xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold mb-2">Qalad ayaa dhacay</h3>
              <p className="mb-3 text-sm">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                Dib u Cusboonaysii
              </button>
            </div>
          ) : apartments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🏠</div>
              <h3 className="text-xl text-white mb-3">Guryo lama helin</h3>
              <p className="text-gray-400 mb-4 max-w-md mx-auto text-sm">
                {selectedDistrict 
                  ? `Ma jiraan guryo la heli karo degmada ${selectedDistrict}. Isku day degmo kale ama wax ka beddel filtarada.`
                  : 'Isku day inaad wax ka beddesho filtarada ama dib u fiiri mar dambe.'
                }
              </p>
              <button
                onClick={resetFilters}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                Dib u Celi Filtarrada
              </button>
            </div>
          ) : (
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {apartments.map((apartment, index) => (
                apartment ? (
                  <motion.div
                    key={apartment.id || Math.random()}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <ApartmentCard apartment={apartment} />
                  </motion.div>
                ) : null
              ))}
            </motion.div>
          )}
        </div>
      </section>
      
      {/* Quick Stats Section - More compact */}
      {apartments.length > 0 && (
        <section className="py-8 bg-gray-800/50">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-2xl font-bold text-blue-400 mb-1">{apartments.length}</div>
                <div className="text-gray-300 text-xs">Guryo La Helay</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {apartments.filter(apt => apt.apartment_floors?.some(floor => floor.floor_status === 'available') || apt.is_available).length}
                </div>
                <div className="text-gray-300 text-xs">La Heli Karaa</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-2xl font-bold text-purple-400 mb-1">
                  {selectedDistrict ? '1' : districts.length}
                </div>
                <div className="text-gray-300 text-xs">
                  {selectedDistrict ? 'Degmo' : 'Degmooyinka'}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-2xl font-bold text-yellow-400 mb-1">
                  ${apartments.length > 0 ? Math.min(...apartments.map(apt => apt.price_per_month)) : 0}+
                </div>
                <div className="text-gray-300 text-xs">Qiimaha Ugu Yar</div>
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* Features Section - More compact */}
      <section className="py-12 bg-gray-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3">Maxay Ka Gaar Yihiin Guryaheena?</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-sm">
              Guryaha casriga ah ee Muqdisho oo leh adeegyo heer sare ah
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              className="p-4 bg-gray-800 rounded-lg border border-gray-700 text-center hover:bg-gray-750 transition-colors"
              whileHover={{ y: -3 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-12 h-12 mx-auto mb-3 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Tignoolajiyad Casri ah</h3>
              <p className="text-gray-400 text-sm">
                Guryaha casriga ah oo leh adeegyo tignoolajiyad ah oo heer sare ah
              </p>
            </motion.div>
            
            <motion.div 
              className="p-4 bg-gray-800 rounded-lg border border-gray-700 text-center hover:bg-gray-750 transition-colors"
              whileHover={{ y: -3 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-12 h-12 mx-auto mb-3 bg-green-600/20 text-green-400 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Goobaha Ugu Fiican</h3>
              <p className="text-gray-400 text-sm">
                Ku yaalla xaafadaha ugu roonaan ee Muqdisho
              </p>
            </motion.div>
            
            <motion.div 
              className="p-4 bg-gray-800 rounded-lg border border-gray-700 text-center hover:bg-gray-750 transition-colors"
              whileHover={{ y: -3 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-12 h-12 mx-auto mb-3 bg-purple-600/20 text-purple-400 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Naqshadeyn Qurux badan</h3>
              <p className="text-gray-400 text-sm">
                Dhismayaal casri ah oo si taxadar leh loo naqshadeeyay
              </p>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}