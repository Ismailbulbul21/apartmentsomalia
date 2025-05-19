import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// Utility function to get image URL from storage path
const getImageUrl = (path) => {
  // Handle null, undefined, or empty strings
  if (!path || path.trim() === '') {
    console.log('Empty or null path provided to getImageUrl, using placeholder');
    return '/images/placeholder-apartment.svg';
  }
  
  // If it's already a complete URL
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  } 
  
  // For storage paths
  try {
    // Handle different path formats
    let normalizedPath = path.trim();
    
    if (normalizedPath.includes('apartment_images/')) {
      normalizedPath = normalizedPath.split('apartment_images/')[1];
    } else if (!normalizedPath.includes('/')) {
      normalizedPath = `apartments/${normalizedPath}`;
    }
    
    // Make sure we don't pass an empty string to Supabase
    if (!normalizedPath || normalizedPath === '') {
      console.log('Normalized path is empty, using placeholder');
      return '/images/placeholder-apartment.svg';
    }
    
    const { data } = supabase.storage
      .from('apartment_images')
      .getPublicUrl(normalizedPath);
    
    // Make sure we have a valid URL before returning
    if (data && data.publicUrl && data.publicUrl.trim() !== '') {
      return data.publicUrl;
    } else {
      console.log('No valid publicUrl found in Supabase response, using placeholder');
      return '/images/placeholder-apartment.svg';
    }
  } catch (error) {
    console.error('Error generating image URL:', error, path);
    return '/images/placeholder-apartment.svg';
  }
};

export default function ApartmentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [apartment, setApartment] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const navigate = useNavigate();

  // Fetch apartment data
  useEffect(() => {
    const fetchApartment = async () => {
      try {
        setLoading(true);
        
        // Fetch apartment with images only
        console.log(`Fetching apartment with ID: ${id}`);
        
        try {
          // First try with the relationship query
          const { data: apartmentData, error: apartmentError } = await supabase
            .from('apartments')
            .select(`
              *,
              apartment_images(id, storage_path, is_primary)
            `)
            .eq('id', id)
            .eq('status', 'approved')
            .single();
          
          if (apartmentError) {
            console.error('Error fetching apartment data:', apartmentError);
            throw apartmentError;
          }
          
          if (!apartmentData) {
            console.error('No apartment data found for ID:', id);
            throw new Error('Apartment not found');
          }
          
          console.log('Apartment data:', apartmentData);
          console.log('Apartment images data:', apartmentData.apartment_images);
          
          // If apartment_images is undefined, try fetching them separately
          if (!apartmentData.apartment_images) {
            console.log('No apartment_images in original query, fetching separately...');
            
            // Fetch images separately as a fallback
            const { data: imagesData, error: imagesError } = await supabase
              .from('apartment_images')
              .select('*')
              .eq('apartment_id', id);
              
            if (!imagesError && imagesData && imagesData.length > 0) {
              console.log('Successfully fetched images separately:', imagesData);
              apartmentData.apartment_images = imagesData;
            } else {
              console.log('No images found in separate query or error:', imagesError);
              // Initialize as empty array to prevent undefined errors
              apartmentData.apartment_images = [];
            }
          }
          
          // Validate image data
          if (apartmentData.apartment_images) {
            // Filter out any invalid images
            apartmentData.apartment_images = apartmentData.apartment_images.filter(img => img && img.storage_path && img.storage_path.trim() !== '');
            console.log('Filtered apartment images:', apartmentData.apartment_images);
          } else {
            // Initialize as empty array to prevent undefined errors
            apartmentData.apartment_images = [];
          }
          
          // Set the apartment data
          setApartment(apartmentData);
          
          // Now fetch the owner profile separately
          if (apartmentData.owner_id) {
            try {
              const { data: ownerData, error: ownerError } = await supabase
                .from('profiles')
                .select('id, full_name, business_name, whatsapp_number, business_phone')
                .eq('id', apartmentData.owner_id)
                .single();
                
              if (!ownerError && ownerData) {
                setOwner(ownerData);
              } else {
                console.error('Error fetching owner:', ownerError);
              }
            } catch (ownerError) {
              console.error('Failed to fetch owner data:', ownerError);
            }
          }
        } catch (fetchError) {
          console.error('Failed to fetch apartment data:', fetchError);
          throw fetchError;
        }
        
        // Fetch reviews only after we've set the apartment data
        try {
          const { data: reviewsData, error: reviewsError } = await supabase
            .from('reviews')
            .select('*')
            .eq('apartment_id', id)
            .order('created_at', { ascending: false });
          
          if (reviewsError) throw reviewsError;
        
        if (reviewsData && reviewsData.length > 0) {
          // Fetch user profiles for reviews
          const userIds = [...new Set(reviewsData.map(review => review.user_id))];
          
          const { data: userProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
            
          if (!profilesError && userProfiles) {
            // Map profiles to reviews
            const profileMap = userProfiles.reduce((map, profile) => {
              map[profile.id] = profile;
              return map;
            }, {});
            
            // Fetch review replies
            const { data: repliesData, error: repliesError } = await supabase
              .from('review_replies')
              .select('*')
              .in('review_id', reviewsData.map(r => r.id));
              
            // Combine reviews with profiles and replies
            const enrichedReviews = reviewsData.map(review => ({
              ...review,
              profiles: profileMap[review.user_id] || null,
              review_replies: !repliesError ? repliesData.filter(reply => reply.review_id === review.id) : []
            }));
            
            setReviews(enrichedReviews);
          } else {
            setReviews(reviewsData);
          }
        } else {
          setReviews([]);
        }
        } catch (reviewError) {
          console.error('Error fetching reviews:', reviewError);
          setReviews([]);
        }
      } catch (error) {
        console.error('Error fetching apartment:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchApartment();
  }, [id]);

  // Handle navigation to the messages tab in user profile
  const handleNavigateToMessages = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/apartments/${id}` } });
      return;
    }
    
    if (!owner) {
      alert('Unable to contact the owner at this time. Please try again later.');
      return;
    }
    
    try {
      // First generate a conversation ID if needed
      const { data: convData, error: convError } = await supabase.rpc('generate_conversation_id', {
        p_user_id_1: user.id,
        p_user_id_2: owner.id,
        p_apartment_id: apartment.id
      });
      
      if (convError) throw convError;
      
      // Navigate to the profile messages tab
      navigate('/profile', { 
        state: { 
          activeTab: 'messages',
          conversationId: convData
        } 
      });
    } catch (error) {
      console.error('Error preparing message conversation:', error);
      alert('Failed to prepare message conversation. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] bg-night-950">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-night-950 text-white min-h-screen py-16">
        <div className="container mx-auto px-4">
          <div className="bg-night-800 border border-night-700 p-6 rounded-xl text-center">
            <h2 className="text-xl font-semibold mb-2 text-red-400">Error</h2>
            <p className="text-night-300">{error}</p>
            <Link to="/" className="mt-6 inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!apartment) {
    return (
      <div className="bg-night-950 text-white min-h-screen py-16">
        <div className="container mx-auto px-4">
          <div className="bg-night-800 border border-night-700 p-6 rounded-xl text-center">
            <h2 className="text-xl font-semibold mb-2">Apartment Not Found</h2>
            <p className="text-night-300">We couldn't find the apartment you're looking for.</p>
            <Link to="/" className="mt-6 inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // Find primary image or first image with improved validation
  let primaryImage = null;
  let firstImage = null;
  let currentImage = null;
  
  // Make sure apartment images exists and is an array
  if (apartment.apartment_images && Array.isArray(apartment.apartment_images) && apartment.apartment_images.length > 0) {
    console.log('Processing apartment images, count:', apartment.apartment_images.length);
    
    // Find primary image if it exists
    primaryImage = apartment.apartment_images.find(img => img && img.is_primary && img.storage_path && img.storage_path.trim() !== '');
    
    // Get first valid image
    const firstValidImage = apartment.apartment_images.find(img => img && img.storage_path && img.storage_path.trim() !== '');
    firstImage = firstValidImage || null;
    
    // Get current image based on index, fallback to primary or first
    currentImage = activeImageIndex < apartment.apartment_images.length 
      ? apartment.apartment_images[activeImageIndex] 
      : null;
      
    // Verify current image has a valid storage path
    if (currentImage && (!currentImage.storage_path || currentImage.storage_path.trim() === '')) {
      currentImage = null;
    }
  } else {
    console.log('No valid apartment images found');
  }
  
  // Final fallback - if no valid current image, use primary or first
  currentImage = currentImage || primaryImage || firstImage;
  
  // Format prices and details
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(apartment.price_per_month);
  
  const getAverageRating = () => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((total, review) => total + review.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };
  
  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <svg 
          key={i} 
          className={`w-4 h-4 ${i <= rating ? 'text-yellow-400' : 'text-night-600'}`} 
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }
    return stars;
  };
  
  return (
    <div className="bg-gradient-to-b from-night-950 to-night-900 text-white min-h-screen">
      {/* Image Gallery Section */}
      <div className="relative bg-night-900">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-night-800 border border-night-700 shadow-lg rounded-xl overflow-hidden">
            <div className="flex flex-col lg:flex-row">
              {/* Main Image */}
              <div className="lg:w-2/3 relative">
                <div className="bg-night-900 aspect-[16/9]">
                  {currentImage && currentImage.storage_path && currentImage.storage_path.trim() !== '' ? (
                    <>
                      <img 
                        src={getImageUrl(currentImage.storage_path)} 
                        alt={apartment.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.log('Image failed to load:', currentImage.storage_path);
                          e.target.onerror = null;
                          e.target.src = '/images/placeholder-apartment.svg';
                        }}
                      />
                      <div className="absolute inset-0 bg-night-900 opacity-0">
                        {/* Invisible fallback that becomes visible if image fails */}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-night-900">
                      <svg className="w-12 h-12 text-night-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-night-400">No image available</p>
                    </div>
                  )}
                </div>
                
                {/* Image carousel controls */}
                {apartment.apartment_images && apartment.apartment_images.length > 1 && (
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between">
                    <button 
                      onClick={() => {
                        const newIndex = activeImageIndex === 0 
                          ? apartment.apartment_images.length - 1 
                          : activeImageIndex - 1;
                        setActiveImageIndex(newIndex);
                      }}
                      className="bg-night-900 bg-opacity-70 hover:bg-opacity-90 text-white p-2 rounded-full"
                      aria-label="Previous image"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <button 
                      onClick={() => {
                        const newIndex = activeImageIndex === apartment.apartment_images.length - 1 
                          ? 0 
                          : activeImageIndex + 1;
                        setActiveImageIndex(newIndex);
                      }}
                      className="bg-night-900 bg-opacity-70 hover:bg-opacity-90 text-white p-2 rounded-full"
                      aria-label="Next image"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {/* Badge for price */}
                <div className="absolute top-4 right-4">
                  <span className="bg-primary-600 text-white px-3 py-1 rounded-lg font-semibold shadow-lg">
                    {formattedPrice}/mo
                  </span>
                </div>
              </div>
              
              {/* Right info panel */}
              <div className="lg:w-1/3 p-6 border-l border-night-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold mb-2">{apartment.title}</h1>
                    <p className="text-night-300 mb-4">{apartment.location_description}</p>
                  </div>
                </div>
                
                <div className="flex items-center mb-6">
                  <div className="flex mr-4">
                    {renderStars(getAverageRating())}
                  </div>
                  <span className="text-sm text-night-300">
                    {getAverageRating()} • {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-night-900 rounded-lg p-3 text-center">
                    <span className="block text-primary-400 text-lg font-semibold">{apartment.rooms}</span>
                    <span className="text-sm text-night-400">Rooms</span>
                  </div>
                  <div className="bg-night-900 rounded-lg p-3 text-center">
                    <span className="block text-primary-400 text-lg font-semibold">{apartment.bathrooms}</span>
                    <span className="text-sm text-night-400">Bathrooms</span>
                  </div>
                  <div className="bg-night-900 rounded-lg p-3 text-center">
                    <span className="block text-primary-400 text-lg font-semibold">{apartment.square_meters} m²</span>
                    <span className="text-sm text-night-400">Area</span>
                  </div>
                  <div className="bg-night-900 rounded-lg p-3 text-center">
                    <span className="block text-primary-400 text-lg font-semibold">{apartment.is_furnished ? 'Yes' : 'No'}</span>
                    <span className="text-sm text-night-400">Furnished</span>
                  </div>
                </div>
                
                {owner && (
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold mb-2">Contact Owner</h3>
                    <div className="flex flex-wrap gap-3">
                      {owner.whatsapp_number && (
                        <a 
                          href={`https://wa.me/${owner.whatsapp_number.replace(/\D/g, '')}?text=Hello, I'm interested in your apartment: ${apartment.title}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                          </svg>
                          WhatsApp
                        </a>
                      )}
                      <button 
                        onClick={handleNavigateToMessages}
                        className="flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Send Message
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Thumbnail strip */}
            {apartment.apartment_images && Array.isArray(apartment.apartment_images) && apartment.apartment_images.length > 1 && (
              <div className="bg-night-950 p-4 border-t border-night-700">
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {apartment.apartment_images.map((image, index) => (
                    <button
                      key={image?.id || `thumb-${index}`}
                      onClick={() => setActiveImageIndex(index)}
                      className={`flex-shrink-0 w-20 h-20 ${
                        activeImageIndex === index ? 'ring-2 ring-primary-500' : ''
                      }`}
                    >
                      {image && image.storage_path && image.storage_path.trim() !== '' ? (
                        <img 
                          src={getImageUrl(image.storage_path)} 
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.log('Thumbnail failed to load:', image.storage_path);
                            e.target.onerror = null;
                            e.target.src = '/images/placeholder-apartment.svg';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-night-800">
                          <span className="text-xs text-night-400">No image</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Details Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Details */}
          <div className="lg:col-span-2">
            {/* About Section with Location */}
            <div className="bg-night-800 border border-night-700 shadow-lg rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">About this apartment</h2>
              
              {/* Location (now more prominent) */}
              <div className="mb-5 p-4 bg-night-750 rounded-lg border border-night-600">
                <h3 className="text-lg font-bold text-primary-300 mb-2">Location</h3>
                {apartment.location_description ? (
                  <p className="text-white">{apartment.location_description}</p>
                ) : (
                  <p className="text-night-400 italic">Location details not available</p>
                )}
              </div>
              
              {/* Description */}
              <div className="prose prose-invert max-w-none text-night-300">
                {apartment.description ? (
                  <p>{apartment.description}</p>
                ) : (
                  <p className="text-night-500 italic">No description available</p>
                )}
              </div>
            </div>
            
            {/* Amenities */}
            <div className="bg-night-800 border border-night-700 shadow-lg rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Amenities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {apartment.has_electricity && (
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-night-200">Electricity</span>
                  </div>
                )}
                {apartment.has_water && (
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span className="text-night-200">Water</span>
                  </div>
                )}
                {apartment.has_internet && (
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                    <span className="text-night-200">Internet</span>
                  </div>
                )}
                {apartment.has_parking && (
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-night-200">Parking</span>
                  </div>
                )}
                {apartment.has_security && (
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="text-night-200">Security</span>
                  </div>
                )}
                {apartment.is_furnished && (
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span className="text-night-200">Furnished</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Reviews Section */}
            <div className="bg-night-800 border border-night-700 shadow-lg rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Reviews</h2>
                
                {user && (
                  <Link 
                    to={`/review/${apartment.id}`}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                  >
                    Write a Review
                  </Link>
                )}
              </div>
              
              {reviews.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-night-400">No reviews yet. Be the first to review!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-night-700 pb-6 last:border-b-0 last:pb-0">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">
                            {review.profiles?.full_name || 'Anonymous User'}
                          </p>
                          <div className="flex items-center mt-1 mb-2">
                            {renderStars(review.rating)}
                            <span className="ml-2 text-sm text-night-400">
                              {new Date(review.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-night-300 mt-2">{review.comment}</p>
                      
                      {/* Review Replies */}
                      {review.review_replies && review.review_replies.length > 0 && (
                        <div className="mt-4 pl-4 border-l-2 border-night-700">
                          {review.review_replies.map(reply => (
                            <div key={reply.id} className="mb-2">
                              <div className="flex items-center">
                                <span className="font-medium text-primary-400">Owner Reply</span>
                                <span className="ml-2 text-xs text-night-400">
                                  {new Date(reply.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-night-400 mt-1">{reply.reply_text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Right Column - Owner Information */}
          <div className="lg:col-span-1">
            {/* Owner Box */}
            {owner && (
              <div className="bg-night-800 border border-night-700 shadow-lg rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold mb-4">Property Owner</h3>
                
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary-900 flex items-center justify-center text-white text-xl font-bold mr-3">
                    {owner.full_name?.charAt(0) || 'O'}
                  </div>
                  <div>
                    <p className="font-medium">{owner.full_name || "Owner"}</p>
                    {owner.business_name && (
                      <p className="text-sm text-night-400">{owner.business_name}</p>
                    )}
                  </div>
                </div>
                
                {user && user.id !== apartment.owner_id && (
                  <div className="space-y-3">
                    <button 
                      onClick={handleNavigateToMessages}
                      className="w-full flex justify-center items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Contact
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Additional Apartment Info */}
            <div className="bg-night-800 border border-night-700 shadow-lg rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Property Details</h3>
              
              {/* Available From */}
              {apartment.available_from && (
                <div className="mb-4">
                  <h4 className="font-medium text-primary-300 mb-1">Available From</h4>
                  <p className="text-night-200">
                    {new Date(apartment.available_from).toLocaleDateString()}
                  </p>
                </div>
              )}
              
              {/* Lease Length */}
              {apartment.min_lease_months && (
                <div className="mb-4">
                  <h4 className="font-medium text-primary-300 mb-1">Minimum Lease</h4>
                  <p className="text-night-200">{apartment.min_lease_months} months</p>
                </div>
              )}
              
              {/* Property Type */}
              {apartment.property_type && (
                <div className="mb-4">
                  <h4 className="font-medium text-primary-300 mb-1">Property Type</h4>
                  <p className="text-night-200">{apartment.property_type}</p>
                </div>
              )}
              
              {/* Deposit */}
              {apartment.deposit_amount && (
                <div>
                  <h4 className="font-medium text-primary-300 mb-1">Security Deposit</h4>
                  <p className="text-night-200">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 0
                    }).format(apartment.deposit_amount)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 