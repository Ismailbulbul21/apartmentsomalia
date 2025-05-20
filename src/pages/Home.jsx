import { useState, useEffect, useCallback, memo, Suspense, lazy, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Link } from 'react-router-dom';

// Utility function to get image URL from storage path
const getImageUrl = (path) => {
  if (!path) {
    return '/images/placeholder-apartment.svg';
  }
  
  // If it's already a complete URL (for demo/sample data)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  } 
  
  // For storage paths
  try {
    // Handle different path formats
    let normalizedPath = path;
    
    if (path.includes('apartment_images/')) {
      normalizedPath = path.split('apartment_images/')[1];
    } else if (!path.includes('/')) {
      normalizedPath = `apartments/${path}`;
    }
    
    const { data } = supabase.storage
      .from('apartment_images')
      .getPublicUrl(normalizedPath);
    
    return data.publicUrl;
  } catch (error) {
    console.error('Error generating image URL:', error, path);
    return '/images/placeholder-apartment.svg';
  }
};

// Lazy-loaded image component with placeholder
const LazyImage = memo(({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  
  useEffect(() => {
    // Process the src to get the correct URL
    const processedSrc = getImageUrl(src);
    setImageSrc(processedSrc);
  }, [src]);
  
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
        alt={alt}
        className={`w-full h-full object-cover transition-all duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setError(true)}
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
  
  // Check if apartment_images exists and is valid before trying to access it 
  let primaryImage = null;
  try {
    primaryImage = apartment.apartment_images && 
                 Array.isArray(apartment.apartment_images) && 
                 apartment.apartment_images.find(img => img && img.is_primary);
  } catch (err) {
    console.error('Error finding primary image:', err);
  }
  
  // Safer image selection with fallbacks
  let imageToShow = { storage_path: '/images/placeholder-apartment.svg' };
  try {
    if (primaryImage) {
      imageToShow = primaryImage;
    } else if (apartment.apartment_images && 
              Array.isArray(apartment.apartment_images) && 
              apartment.apartment_images.length > 0 && 
              apartment.apartment_images[0]) {
      imageToShow = apartment.apartment_images[0];
    }
  } catch (err) {
    console.error('Error determining image to show:', err);
  }
  
  return (
    <motion.div 
      className="modern-card bg-night-900 text-white shadow-lg border border-night-700 overflow-hidden rounded-xl"
      whileHover={{ y: -5, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative">
        <Link to={`/apartments/${apartment.id}`} className="block">
          <LazyImage 
            src={imageToShow.storage_path} 
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
          <h3 className="text-lg font-semibold text-white line-clamp-1 mb-2">{apartment.title}</h3>
          <p className="text-night-300 text-sm mb-4 line-clamp-2">{apartment.location_description}</p>
        </Link>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3 text-xs text-night-300">
            <div className="flex items-center bg-night-800 px-2 py-1 rounded-md">
              <svg className="w-4 h-4 mr-1 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>{apartment.rooms}</span>
            </div>
            <div className="flex items-center bg-night-800 px-2 py-1 rounded-md">
              <svg className="w-4 h-4 mr-1 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span>{apartment.bathrooms}</span>
            </div>
            {apartment.is_furnished && (
              <div className="flex items-center bg-night-800 px-2 py-1 rounded-md">
                <svg className="w-4 h-4 mr-1 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span>Fadhiisan</span>
              </div>
            )}
          </div>
          
          {apartment.owner && apartment.owner.whatsapp_number && (
            <a 
              href={`https://wa.me/${apartment.owner.whatsapp_number.replace(/\D/g, '')}?text=Halo, Waan ku xiiseynayaa gurigaaga: ${apartment.title}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                window.open(`https://wa.me/${apartment.owner.whatsapp_number.replace(/\D/g, '')}?text=Halo, Waan ku xiiseynayaa gurigaaga: ${apartment.title}`, '_blank');
              }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
          )}
        </div>
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
  
  // Memoized fetch function
  const fetchApartments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Reset apartments to prevent stale data display
      setApartments([]);
      
      // Build filters object for debugging
      const filters = {
        minPrice,
        maxPrice,
        minRooms,
        isFurnished,
        selectedDistrict
      };
      
      console.log('Fetching apartments with filters:', filters);
      
      // First, fetch apartments with their images
      console.log('Starting apartment fetch...');
      
      let query = supabase
        .from('apartments')
        .select(`
          *,
          apartment_images(storage_path, is_primary)
        `)
        .eq('status', 'approved')
        .eq('is_available', true);
        
      // More detailed logging
      console.log('Query built:', {
        table: 'apartments',
        filters: {
          status: 'approved',
          is_available: true
        }
      });
      
      // Apply filters if they exist
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
      
      if (selectedDistrict) {
        query = query.eq('district', selectedDistrict);
      }
      
      // Execute the query
      console.log('Executing apartments query...');
      
      let queryData = null;  // Declare variable outside try block to make it accessible throughout the function
      
      try {
        const { data, error } = await query.order('created_at', { ascending: false });
        queryData = data;  // Save data to our outer variable
        
        // Log the results for debugging
        console.log('Apartments query result:', { 
          success: !error,
          dataReceived: data ? 'yes' : 'no', 
          count: data?.length || 0,
          error: error ? {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          } : null
        });
        
        if (error) throw error;
        
        // Log first apartment data for debugging if available
        if (data && data.length > 0) {
          console.log('Sample apartment data:', {
            id: data[0].id,
            title: data[0].title,
            hasImages: (data[0].apartment_images && data[0].apartment_images.length > 0) ? 'yes' : 'no',
            imageCount: data[0].apartment_images?.length || 0
          });
        }
      } catch (queryError) {
        console.error('Error executing query:', queryError);
        throw queryError;
      }
      
      // If we have apartments, fetch the owner profiles separately
      if (queryData && queryData.length > 0) {
        console.log(`Processing ${queryData.length} apartments...`);
        
        try {
          // Get all unique owner IDs
          const ownerIds = [...new Set(queryData.map(apt => apt.owner_id))];
          
          // Fetch profiles for all owners
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, whatsapp_number')
            .in('id', ownerIds);
            
          if (!profilesError && profilesData) {
            console.log(`Found ${profilesData.length} owner profiles`);
            
            // Create a map of owner_id to profile data
            const ownerMap = profilesData.reduce((map, profile) => {
              map[profile.id] = profile;
              return map;
            }, {});
            
            // Enrich apartment data with owner profile info
            const enrichedData = queryData.map(apt => ({
              ...apt,
              owner: ownerMap[apt.owner_id] || null
            }));
            
            // Update state with the enriched data and clear loading/error states
            setApartments(enrichedData);
            setLoading(false);
            setError(null);
          } else {
            // If unable to fetch profiles, still show apartments
            console.log('Could not fetch owner profiles, showing apartments without owner data');
            setApartments(queryData);
            setLoading(false);
            setError(null);
          }
        } catch (profileError) {
          console.error('Error fetching owner profiles:', profileError);
          // If owner profiles fetch fails, still show apartments
          setApartments(queryData);
          setLoading(false);
          setError(null);
        }
      } else {
        // No apartments or queryData is null
        console.log('No apartments found in query result');
        setApartments([]);
      }
    } catch (error) {
      console.error('Error fetching apartments:', error);
      setError('Failed to load apartments. Please try again later.');
      
      // Still set apartments to empty array in case of error
      setApartments([]);
      
      // Try to handle common error cases
      if (error?.code === "PGRST116") {
        console.log("Foreign key violation or invalid query parameters");
      } else if (error?.message?.includes('JWT')) {
        console.log("Authentication error, token may have expired");
      }
    } finally {
      // Make sure loading state is cleared
      setLoading(false);
      
      // Clear any stale error messages if we have apartments
      if (apartments.length > 0) {
        setError(null);
      }
    }
    
    // We no longer need this timeout since we're handling loading state properly
    // in the try/catch/finally blocks
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
    <div className="min-h-screen">
      {/* Hero Section with Integrated Filter */}
      <section className="relative text-white overflow-hidden">
        {/* Background with gradient overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-night-950/90 to-night-900/90 z-10"></div>
          <img 
            src="/images/mogadishu-cityscape.jpg" 
            alt="Muqdisho Muuqaal" 
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/images/futuristic-apartments-hero.jpg";
            }}
          />
          
          {/* Animated gradient effect */}
          <div className="absolute inset-0 z-5 opacity-30">
            <div className="absolute -inset-[10%] bg-gradient-conic from-purple-700 via-primary-800/0 to-teal-600/0 animate-slow-spin"></div>
          </div>
        </div>
        
        <div className="container relative z-20 mx-auto px-4 py-20 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-primary-300 to-white">
              Ka Hel Gurigaaga Ku Haboon Muqdisho
            </h1>
            
            {/* All-in-One Advanced Filter Panel */}
            <motion.div 
              className="bg-night-900/90 backdrop-blur-md p-6 md:p-8 rounded-2xl border border-primary-500/30 shadow-glow mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {/* Search bar with integrated filters */}
              <form onSubmit={handleFilterSubmit} className="space-y-6">
                {/* District selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-primary-300">
                      {selectedDistrict ? `Fiiri Degmada ${selectedDistrict}` : 'Xagee Baad Jeclaan Lahayd Inaad Ku Noolaato?'}
                    </h2>
                    {selectedDistrict && (
                      <button 
                        type="button"
                        onClick={resetFilters}
                        className="text-sm text-primary-400 hover:text-primary-300 flex items-center space-x-1"
                      >
                        <span>Tirtir Dhammaan Filtarrada</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  {/* Mobile dropdown */}
                  <div className="block md:hidden">
                    <div className="relative">
                      <select
                        value={selectedDistrict}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        className="w-full bg-night-800 border border-night-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
                      >
                        <option value="">Dhammaan Degmooyinka</option>
                        {districts.map(district => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-primary-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {selectedDistrict && (
                      <div className="mt-3 flex justify-center">
                        <button
                          onClick={resetFilters}
                          className="flex items-center space-x-1 text-xs text-primary-400 bg-night-700 px-2.5 py-1.5 rounded-full"
                        >
                          <span>Tirtir filtarka "{selectedDistrict}"</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* District chips for desktop */}
                  <div className="hidden md:grid grid-cols-8 gap-2 mb-4">
                    <motion.div
                      onClick={() => handleDistrictChange('')}
                      className={`cursor-pointer rounded-lg p-3 text-center transition-all ${
                        selectedDistrict === '' 
                          ? 'bg-primary-600 text-white shadow-glow-sm' 
                          : 'bg-night-800 hover:bg-night-700 text-gray-300 hover:text-white'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-sm font-medium">Dhamaan</span>
                    </motion.div>
                    
                    {districts.slice(0, 7).map(district => (
                      <motion.div
                        key={district}
                        onClick={() => handleDistrictChange(district)}
                        className={`cursor-pointer rounded-lg p-3 text-center transition-all ${
                          selectedDistrict === district 
                            ? 'bg-primary-600 text-white shadow-glow-sm' 
                            : 'bg-night-800 hover:bg-night-700 text-gray-300 hover:text-white'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        animate={selectedDistrict === district ? 
                          { 
                            y: [0, -5, 0],
                            boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.4)"
                          } : 
                          {}
                        }
                        transition={selectedDistrict === district ? 
                          { duration: 0.5, ease: "easeOut" } : 
                          { duration: 0.3 }
                        }
                      >
                        <span className="text-sm font-medium">{district}</span>
                      </motion.div>
                    ))}
                  </div>
                  
                  <div className="hidden md:grid grid-cols-8 gap-2">
                    {districts.slice(7).map(district => (
                      <motion.div
                        key={district}
                        onClick={() => handleDistrictChange(district)}
                        className={`cursor-pointer rounded-lg p-3 text-center transition-all ${
                          selectedDistrict === district 
                            ? 'bg-primary-600 text-white shadow-glow-sm' 
                            : 'bg-night-800 hover:bg-night-700 text-gray-300 hover:text-white'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        animate={selectedDistrict === district ? 
                          { 
                            y: [0, -5, 0],
                            boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.4)"
                          } : 
                          {}
                        }
                        transition={selectedDistrict === district ? 
                          { duration: 0.5, ease: "easeOut" } : 
                          { duration: 0.3 }
                        }
                      >
                        <span className="text-sm font-medium">{district}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
                
                {/* Advanced filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Qiimaha Ugu Yar ($)</label>
                    <input
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="Qiimaha ugu yar"
                      className="w-full bg-night-800 border border-night-600 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Qiimaha Ugu Badan ($)</label>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Qiimaha ugu badan"
                      className="w-full bg-night-800 border border-night-600 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Qolalka Jiifka</label>
                    <input
                      type="number"
                      value={minRooms}
                      onChange={(e) => setMinRooms(e.target.value)}
                      placeholder="Tirada ugu yar"
                      className="w-full bg-night-800 border border-night-600 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Alaab Guriga</label>
                    <select
                      value={isFurnished}
                      onChange={(e) => setIsFurnished(e.target.value)}
                      className="w-full bg-night-800 border border-night-600 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    >
                      <option value="">Kuu Wada</option>
                      <option value="true">Haa</option>
                      <option value="false">Maya</option>
                    </select>
                  </div>
                </div>
                
                <button
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-3 rounded-lg w-full md:w-auto transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Raadi Guryaha</span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        </div>
      </section>
      
      {/* Apartments Section */}
      <section ref={apartmentsSectionRef} className="bg-gradient-to-b from-night-950 to-night-900 py-10 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between">
              <h2 className="text-3xl font-bold text-white mb-2">
                {selectedDistrict ? `Guryaha ${selectedDistrict}` : 'Guryaha La Heli Karo'}
              </h2>
              
              {selectedDistrict && (
                <button 
                  onClick={resetFilters}
                  className="flex items-center bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-primary-700 transition-colors"
                >
                  <span>Tirtir filtarka</span>
                  <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {selectedDistrict && (
              <div className="mt-2 flex items-center text-primary-300">
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm">Itus natiijadaha la shaandheeyay</span>
              </div>
            )}
          </div>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-800 text-red-200 p-4 rounded-lg">
              {error}
            </div>
          ) : apartments.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-night-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <h3 className="text-xl text-white mb-2">Guryo lama helin</h3>
              <p className="text-night-300">Isku day inaad wax ka beddesho filtarada ama dib u fiiri mar dambe.</p>
              <button
                onClick={resetFilters}
                className="mt-4 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
              >
                Dib u Celi Filtarrada
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.isArray(apartments) && apartments.length > 0 ? (
                apartments.map((apartment) => (
                  apartment ? <ApartmentCard key={apartment.id || Math.random()} apartment={apartment} /> : null
                ))
              ) : (
                <div className="col-span-4 text-center py-12">
                  <p className="text-night-300">Ma jiraan guryo la heli karo.</p>
                  <button
                    onClick={resetFilters}
                    className="mt-4 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                  >
                    Dib u Celi Filtarrada
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      
      {/* Features Section */}
      <section className="bg-night-950 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Nolol Cusub oo La Qaabeeyay</h2>
            <p className="text-night-300 max-w-2xl mx-auto">
              Guryaheena casriga ah waxaa loogu talagalay hab-nololeedkaaga, iyagoo bixiya adeegyo heer sare ah iyo faahfaahino si taxadar leh loo sameeyey.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div 
              className="p-6 bg-night-900 rounded-xl border border-night-800 text-center"
              whileHover={{ y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-900/30 text-primary-400 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Tignoolajiyada Guryaha Casriga ah</h3>
              <p className="text-night-300">
                Ka xakamee iftiinka, cimilada, iyo amniga telefoonkaaga casriga ah adigoo isticmaalaya astaamaha guryaha casriga ah ee la isku dhafay.
              </p>
            </motion.div>
            
            <motion.div 
              className="p-6 bg-night-900 rounded-xl border border-night-800 text-center"
              whileHover={{ y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-900/30 text-primary-400 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Goobaha Ugu Fiican</h3>
              <p className="text-night-300">
                Ku yaalla xaafadaha ugu roonaan iyadoo si fudud looga heli karo gaadiidka iyo adeegyada.
              </p>
            </motion.div>
            
            <motion.div 
              className="p-6 bg-night-900 rounded-xl border border-night-800 text-center"
              whileHover={{ y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-900/30 text-primary-400 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Naqshadeyn Casri ah</h3>
              <p className="text-night-300">
                Dhismayaal casri ah, qolal ballaaran oo furan, iyo meelo nololeed si taxadar leh loo naqshadeeyay.
              </p>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="relative bg-night-900 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-6">Ma diyaar u tahay inaad hesho gurigaaga ku haboon?</h2>
            <p className="text-night-300 text-lg mb-8">
              Ku biir kumanaan qof oo ku qanacsan oo helay guryahooda ku haboon annaga.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link 
                to="/signup" 
                className="bg-primary-500 hover:bg-primary-600 text-white text-lg px-8 py-3 rounded-lg shadow-lg transition-all duration-300 inline-block"
              >
                Ku Bilow Maanta
              </Link>
              <Link 
                to="/contact" 
                className="bg-night-800 hover:bg-night-700 text-white text-lg px-8 py-3 rounded-lg shadow-lg transition-all duration-300 border border-night-600"
              >
                Nala Soo Xiriir
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}