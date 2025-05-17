import { useState, useEffect, useCallback, memo, Suspense, lazy } from 'react';
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
  // Find the primary image, or use the first one
  const primaryImage = apartment.apartment_images && apartment.apartment_images.find(img => img.is_primary);
  const imageToShow = primaryImage || 
                    (apartment.apartment_images && apartment.apartment_images.length > 0 
                      ? apartment.apartment_images[0] 
                      : { storage_path: '/images/placeholder-apartment.svg' });
  
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
            ${apartment.price_per_month}/mo
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
                <span>Furnished</span>
              </div>
            )}
          </div>
          
          {apartment.owner && apartment.owner.whatsapp_number && (
            <a 
              href={`https://wa.me/${apartment.owner.whatsapp_number.replace(/\D/g, '')}?text=Hello, I'm interested in your apartment: ${apartment.title}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                window.open(`https://wa.me/${apartment.owner.whatsapp_number.replace(/\D/g, '')}?text=Hello, I'm interested in your apartment: ${apartment.title}`, '_blank');
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
      
      // Build filters object for debugging
      const filters = {
        minPrice,
        maxPrice,
        minRooms,
        isFurnished,
        selectedDistrict
      };
      
      // First, fetch apartments with their images
      let query = supabase
        .from('apartments')
        .select(`
          *,
          apartment_images(storage_path, is_primary)
        `)
        .eq('status', 'approved')
        .eq('is_available', true);
      
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
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // If we have apartments, fetch the owner profiles separately
      if (data && data.length > 0) {
        // Get all unique owner IDs
        const ownerIds = [...new Set(data.map(apt => apt.owner_id))];
        
        // Fetch profiles for all owners
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, whatsapp_number')
          .in('id', ownerIds);
          
        if (!profilesError && profilesData) {
          // Create a map of owner_id to profile data
          const ownerMap = profilesData.reduce((map, profile) => {
            map[profile.id] = profile;
            return map;
          }, {});
          
          // Enrich apartment data with owner profile info
          const enrichedData = data.map(apt => ({
            ...apt,
            owner: ownerMap[apt.owner_id] || null
          }));
          
          setApartments(enrichedData);
        } else {
          // If unable to fetch profiles, still show apartments
          setApartments(data);
        }
      } else {
        setApartments(data || []);
      }
    } catch (error) {
      console.error('Error fetching apartments:', error);
      setError('Failed to load apartments. Please try again later.');
    } finally {
      setLoading(false);
    }
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
  };

  const handleDistrictChange = (district) => {
    setSelectedDistrict(district);
    // Don't call fetchApartments here as the useEffect will handle it
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
            alt="Mogadishu Cityscape" 
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
              Find Your Perfect Home in Mogadishu
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
                      {selectedDistrict ? `Browsing ${selectedDistrict} District` : 'Where would you like to live?'}
                    </h2>
                    {selectedDistrict && (
                      <button 
                        type="button"
                        onClick={resetFilters}
                        className="text-sm text-primary-400 hover:text-primary-300 flex items-center space-x-1"
                      >
                        <span>Clear all filters</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  {/* Mobile dropdown */}
                  <div className="block md:hidden">
                    <select
                      value={selectedDistrict}
                      onChange={(e) => handleDistrictChange(e.target.value)}
                      className="w-full bg-night-800 border border-night-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">All Districts</option>
                      {districts.map(district => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
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
                      <span className="text-sm font-medium">All</span>
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
                      >
                        <span className="text-sm font-medium">{district}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
                
                {/* Advanced filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Min Price ($)</label>
                    <input
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="Min price"
                      className="w-full bg-night-800 border border-night-600 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Max Price ($)</label>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Max price"
                      className="w-full bg-night-800 border border-night-600 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Bedrooms</label>
                    <input
                      type="number"
                      value={minRooms}
                      onChange={(e) => setMinRooms(e.target.value)}
                      placeholder="Min bedrooms"
                      className="w-full bg-night-800 border border-night-600 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Furnished</label>
                    <select
                      value={isFurnished}
                      onChange={(e) => setIsFurnished(e.target.value)}
                      className="w-full bg-night-800 border border-night-600 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    >
                      <option value="">Any</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
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
                  <span>Search Apartments</span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        </div>
      </section>
      
      {/* Apartments Section */}
      <section className="bg-gradient-to-b from-night-950 to-night-900 py-10 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              {selectedDistrict ? `Apartments in ${selectedDistrict}` : 'Available Apartments'}
            </h2>
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
              <h3 className="text-xl text-white mb-2">No apartments found</h3>
              <p className="text-night-300">Try adjusting your filters or check back later.</p>
              <button
                onClick={resetFilters}
                className="mt-4 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {apartments.map((apartment) => (
                <ApartmentCard key={apartment.id} apartment={apartment} />
              ))}
            </div>
          )}
        </div>
      </section>
      
      {/* Features Section */}
      <section className="bg-night-950 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Living Reimagined</h2>
            <p className="text-night-300 max-w-2xl mx-auto">
              Our modern apartments are designed with your lifestyle in mind, offering premium amenities and thoughtful details.
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
              <h3 className="text-xl font-bold text-white mb-2">Smart Home Technology</h3>
              <p className="text-night-300">
                Control lighting, climate, and security from your smartphone with integrated smart home features.
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
              <h3 className="text-xl font-bold text-white mb-2">Premium Locations</h3>
              <p className="text-night-300">
                Located in the most desirable neighborhoods with convenient access to transportation and amenities.
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
              <h3 className="text-xl font-bold text-white mb-2">Modern Design</h3>
              <p className="text-night-300">
                Contemporary finishes, spacious open layouts, and thoughtfully designed living spaces.
              </p>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="relative bg-night-900 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-6">Ready to find your perfect apartment?</h2>
            <p className="text-night-300 text-lg mb-8">
              Join thousands of satisfied residents who've found their ideal home with us.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link 
                to="/signup" 
                className="bg-primary-500 hover:bg-primary-600 text-white text-lg px-8 py-3 rounded-lg shadow-lg transition-all duration-300 inline-block"
              >
                Get Started Today
              </Link>
              <Link 
                to="/contact" 
                className="bg-night-800 hover:bg-night-700 text-white text-lg px-8 py-3 rounded-lg shadow-lg transition-all duration-300 border border-night-600"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
} 