import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, uploadApartmentImage } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { getImageUrl } from '../utils/imageUtils';

// Sub-components for dashboard tabs
const MyListings = () => {
  const { user } = useAuth();
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedApartment, setExpandedApartment] = useState(null);
  const [apartmentFloors, setApartmentFloors] = useState({});
  const [updatingFloor, setUpdatingFloor] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApartments = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('apartments')
          .select(`
            *,
            apartment_images(id, storage_path, is_primary),
            reviews(id)
          `)
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Process apartments to ensure image URLs are correct
        if (data && data.length > 0) {
          console.log("Fetched apartments:", data);
          
          // Log the first apartment's images for debugging
          if (data[0].apartment_images) {
            console.log("Sample apartment images:", data[0].apartment_images);
          }

          // Check if any fix is needed for image paths
          const processedData = data.map(apartment => {
            if (apartment.apartment_images && apartment.apartment_images.length > 0) {
              // Process apartment images if needed
              apartment.apartment_images = apartment.apartment_images.map(image => {
                console.log("Image storage path:", image.storage_path);
                return image;
              });
            }
            return apartment;
          });
          
          setApartments(processedData || []);
        } else {
          setApartments([]);
        }
      } catch (error) {
        console.error('Error fetching apartments:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchApartments();
  }, [user.id]);

  // Fetch floors for a specific apartment
  const fetchApartmentFloors = async (apartmentId) => {
    try {
      const { data: floorsData, error: floorsError } = await supabase
        .from('apartment_floors')
        .select('*')
        .eq('apartment_id', apartmentId)
        .order('floor_number', { ascending: true });
        
      if (!floorsError && floorsData) {
        setApartmentFloors(prev => ({
          ...prev,
          [apartmentId]: floorsData
        }));
      }
    } catch (error) {
      console.error('Error fetching floors:', error);
    }
  };

  // Toggle floor availability
  const toggleFloorAvailability = async (apartmentId, floorId, currentStatus) => {
    try {
      setUpdatingFloor(floorId);
      
      // Simple toggle: available <-> not_available
      const newStatus = currentStatus === 'available' ? 'not_available' : 'available';
      
      const { error } = await supabase
        .from('apartment_floors')
        .update({ 
          floor_status: newStatus,
          is_available: newStatus === 'available'
        })
        .eq('id', floorId);
        
      if (error) throw error;
      
      // Calculate updated floors FIRST before updating state
      const updatedFloors = apartmentFloors[apartmentId].map(floor => 
        floor.id === floorId 
          ? { ...floor, floor_status: newStatus, is_available: newStatus === 'available' }
          : floor
      );
      
      // Calculate apartment availability based on updated floors
      const hasAvailableFloors = updatedFloors.some(floor => floor.floor_status === 'available');
      
      // Update local state with the updated floors
      setApartmentFloors(prev => ({
        ...prev,
        [apartmentId]: updatedFloors
      }));
      
      // Update apartment availability in database
      const { error: apartmentError } = await supabase
        .from('apartments')
        .update({ is_available: hasAvailableFloors })
        .eq('id', apartmentId);
        
      if (apartmentError) {
        console.error('Error updating apartment availability:', apartmentError);
      }
      
      // Update apartments state with new availability
      setApartments(apartments.map(apt => 
        apt.id === apartmentId 
          ? { ...apt, is_available: hasAvailableFloors } 
          : apt
      ));
      
    } catch (error) {
      console.error('Error toggling floor availability:', error);
      alert('Failed to update floor availability. Please try again.');
    } finally {
      setUpdatingFloor(null);
    }
  };

  const handleCreateNew = () => {
    navigate('/owner/dashboard/new-listing');
  };

  const handleEdit = (id) => {
    navigate(`/owner/dashboard/edit-listing/${id}`);
  };

  const handleToggleAvailability = async (apartment) => {
    try {
      const { error } = await supabase
        .from('apartments')
        .update({ is_available: !apartment.is_available })
        .eq('id', apartment.id);
        
      if (error) throw error;
      
      // Update the local state
      setApartments(apartments.map(apt => 
        apt.id === apartment.id 
          ? { ...apt, is_available: !apt.is_available } 
          : apt
      ));
    } catch (error) {
      console.error('Error toggling availability:', error);
      alert('Failed to update availability. Please try again.');
    }
  };

  const toggleApartmentExpansion = (apartmentId) => {
    if (expandedApartment === apartmentId) {
      setExpandedApartment(null);
    } else {
      setExpandedApartment(apartmentId);
      // Fetch floors if not already loaded
      if (!apartmentFloors[apartmentId]) {
        fetchApartmentFloors(apartmentId);
      }
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'available': { label: 'Waa la heli karaa', color: 'bg-green-100 text-green-800', icon: '✓' },
      'not_available': { label: 'Lama heli karo', color: 'bg-red-100 text-red-800', icon: '✕' }
    };
    
    // Map old statuses to new simplified ones
    const normalizedStatus = status === 'available' ? 'available' : 'not_available';
    const config = statusConfig[normalizedStatus];
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  const getFloorLabel = (floorNumber, totalFloors) => {
    if (floorNumber === 1) return 'Dabaqda Hoose';
    if (floorNumber === totalFloors) return `Dabaqda ${floorNumber}aad (Sare)`;
    return `Dabaqda ${floorNumber}aad`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded-md">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Liistada Guryahaaga</h2>
        <motion.button 
          onClick={handleCreateNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Samee Liis Cusub
        </motion.button>
      </div>
      
      {apartments.length === 0 ? (
        <motion.div 
          className="bg-yellow-50 p-6 rounded-lg text-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-gray-700 mb-4">Weli ma sameysan liis guri ah.</p>
          <motion.button 
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Samee Liiskaaga Ugu Horeeyay
          </motion.button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {apartments.map((apartment, index) => (
            <motion.div 
              key={apartment.id} 
              className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <div className="md:flex">
                <div className="md:flex-shrink-0 w-full md:w-48 h-48 overflow-hidden">
                  {apartment.apartment_images && apartment.apartment_images.length > 0 ? (
                    <img
                      src={(() => {
                        try {
                          // First try to use the primary_image_path if available
                          if (apartment.primary_image_path) {
                            console.log('Using primary_image_path:', apartment.primary_image_path);
                            return getImageUrl(apartment.primary_image_path);
                          }
                          
                          // Otherwise find the primary image from the images array
                          const primaryImage = apartment.apartment_images.find(img => img.is_primary);
                          const imageToUse = primaryImage || apartment.apartment_images[0];
                          
                          console.log('Using image from array:', imageToUse);
                          return getImageUrl(imageToUse.storage_path);
                        } catch (err) {
                          console.error('Error determining image URL:', err);
                          return '/images/placeholder-apartment.svg';
                        }
                      })()}
                      alt={apartment.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                      onError={(e) => {
                        console.error("Image failed to load:", e.target.src);
                        e.target.src = '/images/placeholder-apartment.svg';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <p className="text-gray-500">Sawir ma jiro</p>
                    </div>
                  )}
                </div>
                
                <div className="p-4 flex-grow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-1">{apartment.title}</h3>
                      <p className="text-gray-600 text-sm mb-2">{apartment.location_description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                        La Daabacay
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        apartment.is_available 
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {apartment.is_available ? 'La Heli Karaa' : 'Lama Heli Karo'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Qiimaha:</span> ${apartment.price_per_month}/bishii
                    </div>
                    <div className="text-sm text-gray-700 ml-4">
                      <span className="font-medium">Qolal:</span> {apartment.rooms}
                    </div>
                    <div className="text-sm text-gray-700 ml-4">
                      <span className="font-medium">Musqul:</span> {apartment.bathrooms}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">La sameeyay:</span> {new Date(apartment.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex space-x-2">
                      <motion.button
                        onClick={() => toggleApartmentExpansion(apartment.id)}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors text-sm"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {expandedApartment === apartment.id ? 'Qari Dabaqyada' : 'Muuji Dabaqyada'}
                      </motion.button>
                      <motion.button
                        onClick={() => handleEdit(apartment.id)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Wax ka beddel
                      </motion.button>
                      <motion.button
                        onClick={() => handleToggleAvailability(apartment)}
                        className={`px-3 py-1 rounded-md transition-colors text-sm ${
                          apartment.is_available
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {apartment.is_available ? 'Ka dhig Lama Heli Karo' : 'Ka dhig La Heli Karaa'}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floor Management Section */}
              {expandedApartment === apartment.id && (
                <motion.div 
                  className="border-t border-gray-200 bg-gray-50 p-4"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="font-medium text-gray-800 mb-3">Maamulka Dabaqyada</h4>
                  
                  {apartmentFloors[apartment.id] ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {apartmentFloors[apartment.id].map((floor) => (
                        <div key={floor.id} className="bg-white p-3 rounded-lg border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h5 className="font-medium text-gray-800">
                                {getFloorLabel(floor.floor_number, apartmentFloors[apartment.id].length)}
                              </h5>
                              <p className="text-sm text-gray-600">${floor.price_per_month}/bishii</p>
                            </div>
                            {getStatusBadge(floor.floor_status)}
                          </div>
                          
                          <div className="text-xs text-gray-500 mb-2">
                            {floor.bedrooms_on_floor} qol jiif • {floor.bathrooms_on_floor} musqul
                          </div>
                          
                          <button
                            onClick={() => toggleFloorAvailability(apartment.id, floor.id, floor.floor_status)}
                            disabled={updatingFloor === floor.id}
                            className={`w-full px-2 py-1 text-xs rounded transition-colors ${
                              updatingFloor === floor.id
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            {updatingFloor === floor.id ? 'Waa la beddelayaa...' : 'Beddel Xaaladda'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Dabaqyada waa la soo raraa...</p>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

const Reviews = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        
        // First, fetch reviews with apartments and replies
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select(`
            *,
            apartments(id, title, owner_id),
            review_replies(id, reply_text, created_at)
          `)
          .order('created_at', { ascending: false });
        
        if (reviewsError) throw reviewsError;
        
        // Filter reviews for apartments owned by this user
        const filteredReviews = reviewsData?.filter(review => 
          review.apartments?.owner_id === user.id
        ) || [];
        
        if (filteredReviews.length > 0) {
          // Get unique user IDs from filtered reviews
          const userIds = [...new Set(filteredReviews.map(review => review.user_id))];
          
          // Fetch profiles for those user IDs
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
            
          if (profilesError) throw profilesError;
          
          // Create a profiles map for easy lookup
          const profilesMap = (profilesData || []).reduce((map, profile) => {
            map[profile.id] = profile;
            return map;
          }, {});
          
          // Combine reviews with profile data
          const enrichedReviews = filteredReviews.map(review => ({
            ...review,
            profiles: profilesMap[review.user_id] || null
          }));
          
          setReviews(enrichedReviews);
        } else {
          setReviews([]);
        }
      } catch (error) {
        console.error('Error fetching reviews:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReviews();
  }, [user.id]);

  const handleReply = async (reviewId) => {
    if (!replyText.trim()) return;
    
    try {
      setSubmitting(true);
      
      const { error } = await supabase
        .from('review_replies')
        .insert({
          review_id: reviewId,
          reply_text: replyText,
          owner_id: user.id
        });
      
      if (error) throw error;
      
      // Update local state
      setReviews(reviews.map(review => 
        review.id === reviewId 
          ? { 
              ...review, 
              review_replies: [
                ...review.review_replies || [],
                { 
                  id: Date.now(), // Temporary ID until we refresh
                  reply_text: replyText,
                  created_at: new Date().toISOString()
                }
              ]
            } 
          : review
      ));
      
      // Clear the reply text
      setReplyText('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error replying to review:', error);
      alert('Failed to reply to review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded-md">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-xl font-semibold mb-6">Faallooyinka Guryahaaga</h2>
      
      {reviews.length === 0 ? (
        <motion.div 
          className="bg-gray-50 p-6 rounded-lg text-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-gray-600">Weli ma haysato faallo guryahaaga ah.</p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review, index) => (
            <motion.div 
              key={review.id} 
              className="bg-white p-5 rounded-lg shadow-sm border border-gray-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <div className="mb-4">
                <div className="flex justify-between">
                  <h3 className="font-semibold">{review.apartments?.title || 'Guri aan la aqoon'}</h3>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <svg 
                        key={i} 
                        className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`} 
                        fill="currentColor" 
                        viewBox="0 0 20 20" 
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Qoray: {review.profiles?.full_name || 'Qof aan la aqoon'} | {new Date(review.created_at).toLocaleDateString()}
                </p>
              </div>
              
              <p className="text-gray-700 mb-4">{review.comment}</p>
              
              {/* Owner Replies */}
              {review.review_replies && review.review_replies.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-md mb-4">
                  <p className="font-medium text-gray-800 mb-1">Jawaabta Aad Bixisay:</p>
                  <p className="text-gray-700">{review.review_replies[0].reply_text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(review.review_replies[0].created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              
              {/* Reply Form */}
              {!review.review_replies || review.review_replies.length === 0 ? (
                <div className="mt-4">
                  <div className="mb-2">
                    <textarea
                      value={replyingTo === review.id ? replyText : ''}
                      onChange={(e) => {
                        setReplyText(e.target.value);
                        setReplyingTo(review.id);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Qor jawaab faallooyinkan..."
                    ></textarea>
                  </div>
                  <motion.button
                    onClick={() => handleReply(review.id)}
                    disabled={submitting || !replyText.trim() || replyingTo !== review.id}
                    className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {submitting && replyingTo === review.id ? 'Waa la diraa...' : 'Jawaab Faallada'}
                  </motion.button>
                </div>
              ) : null}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

const NewListing = () => {
  const { user, isAdminUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  
  // Debug log to verify component is rendering
  console.log('NewListing component is rendering - floor system should be visible');
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location_description: '',
    district: '',
    is_furnished: false,
    total_floors: 1,
    has_floor_system: true,
    whatsapp_number: '',
    display_owner_name: ''
  });
  
  // Floor data state
  const [floors, setFloors] = useState([
    {
      floor_number: 1,
      bedrooms_on_floor: 1,
      bathrooms_on_floor: 1,
      has_kitchen: true,
      has_living_room: true,
      price_per_month: '',
      floor_description: '',
      floor_status: 'available'
    }
  ]);
  
  // Mogadishu districts
  const districts = [
    "Abdiaziz", "Bondhere", "Daynile", "Dharkenley", "Hamar Jajab", "Hamar Weyne",
    "Hodan", "Howl Wadaag", "Huriwa", "Karan", "Shangani", "Shibis",
    "Waberi", "Wadajir", "Warta Nabada", "Yaqshid"
  ];

  // Handle image selection
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Limit to 10 images
    const limitedFiles = files.slice(0, 10);
    setImageFiles(prev => [...prev, ...limitedFiles].slice(0, 10));
    
    // Create previews
    limitedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, e.target.result].slice(0, 10));
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove image
  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    if (primaryImageIndex >= index && primaryImageIndex > 0) {
      setPrimaryImageIndex(prev => prev - 1);
    }
  };

  // Handle total floors change
  const handleTotalFloorsChange = (newTotal) => {
    const totalFloors = parseInt(newTotal);
    setFormData(prev => ({ ...prev, total_floors: totalFloors }));
    
    // Update floors array
    const newFloors = [];
    for (let i = 1; i <= totalFloors; i++) {
      const existingFloor = floors.find(f => f.floor_number === i);
      if (existingFloor) {
        newFloors.push(existingFloor);
      } else {
        newFloors.push({
          floor_number: i,
          bedrooms_on_floor: 1,
          bathrooms_on_floor: 1,
          has_kitchen: true,
          has_living_room: true,
          has_master_room: false,
          price_per_month: formData.price_per_month || 100,
          floor_description: '',
          floor_status: 'available'
        });
      }
    }
    setFloors(newFloors);
  };

  // Update floor data
  const updateFloor = (index, field, value) => {
    setFloors(prev => prev.map((floor, i) => 
      i === index ? { ...floor, [field]: value } : floor
    ));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      alert('Fadlan gali magaca guriga');
      return;
    }
    
    if (!formData.location_description.trim()) {
      alert('Fadlan gali meesha guriga ku yaal');
      return;
    }
    
    if (!formData.district) {
      alert('Fadlan dooro degmada');
      return;
    }
    
    if (imageFiles.length === 0) {
      alert('Fadlan soo geli ugu yaraan hal sawir');
      return;
    }
    
    // Validate floors
    for (let i = 0; i < floors.length; i++) {
      const floor = floors[i];
      if (!floor.price_per_month || floor.price_per_month <= 0) {
        alert(`Fadlan gali qiimaha dabaqda ${i + 1}`);
        return;
      }
    }
    
    try {
      setLoading(true);
      
      // Calculate apartment-level data from floors
      const totalRooms = floors.reduce((sum, floor) => sum + parseInt(floor.bedrooms_on_floor), 0);
      const totalBathrooms = floors.reduce((sum, floor) => sum + parseInt(floor.bathrooms_on_floor), 0);
      const minPrice = Math.min(...floors.map(f => parseFloat(f.price_per_month)));
      
      // Create apartment record - FORCE APPROVED STATUS
      const apartmentData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        location_description: formData.location_description.trim(),
        district: formData.district,
        rooms: totalRooms,
        bathrooms: totalBathrooms,
        price_per_month: minPrice,
        is_furnished: formData.is_furnished,
        is_available: true,
        status: 'approved', // ALWAYS APPROVED - NO ADMIN APPROVAL NEEDED
        owner_id: user.id,
        whatsapp_number: formData.whatsapp_number.trim(),
        display_owner_name: formData.display_owner_name.trim() || null,
        created_at: new Date().toISOString()
      };
      
      const { data: apartmentResult, error: apartmentError } = await supabase
        .from('apartments')
        .insert(apartmentData)
        .select()
        .single();
      
      if (apartmentError) throw apartmentError;
      
      const apartmentId = apartmentResult.id;
      
      // FORCE UPDATE TO APPROVED STATUS - BULLETPROOF SOLUTION
      await supabase
        .from('apartments')
        .update({ status: 'approved' })
        .eq('id', apartmentId);
      
      // Upload images
      const imageUploadPromises = imageFiles.map(async (file, index) => {
        const isPrimary = index === primaryImageIndex;
        return uploadApartmentImage(file, apartmentId, isPrimary);
      });
      
      const imageResults = await Promise.all(imageUploadPromises);
      
      // Check for image upload errors
      const failedUploads = imageResults.filter(result => !result.success);
      if (failedUploads.length > 0) {
        console.error('Some images failed to upload:', failedUploads);
      }
      
      // Create floor records
      const floorData = floors.map(floor => ({
        apartment_id: apartmentId,
        floor_number: floor.floor_number,
        bedrooms_on_floor: parseInt(floor.bedrooms_on_floor),
        bathrooms_on_floor: parseInt(floor.bathrooms_on_floor),
        has_kitchen: floor.has_kitchen,
        has_living_room: floor.has_living_room,
        price_per_month: parseFloat(floor.price_per_month),
        floor_description: floor.floor_description.trim(),
        floor_status: floor.floor_status,
        is_available: floor.floor_status === 'available',
        created_at: new Date().toISOString()
      }));
      
      const { error: floorsError } = await supabase
        .from('apartment_floors')
        .insert(floorData);
        
      if (floorsError) throw floorsError;
      
      alert('✅ GUUL! Liiskaaga waa la sameeyay oo ISLA MARKIIBA waa la daabacay! Dadka ayaa hadda arki karaan - ma aha inay sugaan ansaxi!');
        navigate('/owner/dashboard');
      
    } catch (error) {
      console.error('Error creating apartment:', error);
      alert('Qalad ayaa dhacay. Fadlan isku day mar kale.');
    } finally {
      setLoading(false);
    }
  };

  const getFloorLabel = (floorNumber) => {
    if (floorNumber === 1) return 'Dabaqda Hoose';
    if (floorNumber === floors.length) return `Dabaqda ${floorNumber}aad (Sare)`;
    return `Dabaqda ${floorNumber}aad`;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto px-2 sm:px-4"
    >
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 px-4 sm:px-6 py-4 sm:py-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">✨ Samee Liis Cusub</h2>
          <p className="text-gray-300 text-base sm:text-lg">Buuxi macluumaadka gurigaaga si aad u sameyso liis cusub</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 bg-white">
          {/* Basic Information */}
          <div className="space-y-4 sm:space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
              Macluumaadka Aasaasiga ah
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Magaca Guriga *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tusaale: Guri Qurux badan oo Hodan ku yaal"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Degmada *
                </label>
                <select
                  value={formData.district}
                  onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                  className="w-full px-3 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Dooro degmada</option>
                  {districts.map(district => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>
              
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meesha Guriga ku yaal *
                </label>
                <input
                  type="text"
                  value={formData.location_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, location_description: e.target.value }))}
                  className="w-full px-3 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tusaale: Wadada Makka Al-Mukarrama, agagaarka suuqa weyn"
                  required
                />
              </div>
              
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Faahfaahin Apartment
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Qor faahfaahin dheeraad ah oo ku saabsan guriga..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📱 WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                  className="w-full px-3 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tusaale: +252 61 1234567"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Dadka raba guriga waxay kugu soo waci karaan WhatsApp
                </p>
              </div>
              
              {/* Admin-Only: Custom Owner Name */}
              {isAdminUser && (
                <div className="lg:col-span-2 border-4 border-red-500 bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <span className="text-lg mr-2">👑</span>
                    <h4 className="text-lg font-bold text-red-800">Admin Only - Customer Information</h4>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-red-700 mb-2">
                      Real Owner Name (Customer's Name)
                    </label>
                    <input
                      type="text"
                      value={formData.display_owner_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, display_owner_name: e.target.value }))}
                      className="w-full px-3 py-3 text-base border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Tusaale: Ahmed Mohamed Ali"
                    />
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ Only for customers who cannot create accounts. Leave empty for regular owners.
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      📱 Make sure WhatsApp above is the customer's number, not yours!
                    </p>
                  </div>
                </div>
              )}
            </div>
                  
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_furnished"
                checked={formData.is_furnished}
                onChange={(e) => setFormData(prev => ({ ...prev, is_furnished: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_furnished" className="ml-2 block text-sm text-gray-700">
                Gurigu wuxuu leeyahay alaab (furnished)
              </label>
            </div>
          </div>
            
          {/* Images Section */}
          <div className="space-y-4 sm:space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
              Sawirrada Guriga
            </h3>
            
                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                Soo geli sawirrada guriga (ugu badan 10) *
                  </label>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageChange}
                className="w-full px-3 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Sawirka ugu horreeya ayaa noqon doona sawirka ugu muhiimsan
              </p>
                </div>
                
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                            alt={`Preview ${index + 1}`}
                      className={`w-full h-20 sm:h-24 object-cover rounded-md border-2 ${
                        index === primaryImageIndex ? 'border-blue-500' : 'border-gray-200'
                      }`}
                    />
                    {index === primaryImageIndex && (
                      <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1 rounded">
                        Ugu muhiimsan
                      </div>
                    )}
                              <button
                                type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 touch-manipulation"
                    >
                      ×
                              </button>
              <button
                      type="button"
                      onClick={() => setPrimaryImageIndex(index)}
                      className="absolute bottom-1 left-1 bg-gray-800 bg-opacity-75 text-white text-xs px-1 py-0.5 rounded hover:bg-opacity-100 touch-manipulation"
                    >
                      Ka dhig ugu muhiimsan
              </button>
            </div>
                ))}
          </div>
      )}
    </div>

          {/* Floors Section */}
          <div className="space-y-4 sm:space-y-6 border-4 border-blue-500 bg-blue-50 p-4 sm:p-6 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-2 space-y-2 sm:space-y-0">
              <h3 className="text-lg sm:text-xl font-bold text-blue-800">
                🏢 Dabaqyada Guriga (FLOOR SYSTEM)
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <label className="text-sm sm:text-base font-bold text-blue-800">
                  Tirada dabaqyada: {formData.total_floors}
                </label>
                <select
                  value={formData.total_floors}
                  onChange={(e) => handleTotalFloorsChange(e.target.value)}
                  className="px-3 py-2 border-2 border-blue-300 rounded-lg text-base sm:text-lg font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-0"
                >
                  {[1,2,3,4,5,6,7,8,9,10].map(num => (
                    <option key={num} value={num}>{num} dabaq</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-6">
              {floors.map((floor, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-800 mb-4">
                    {getFloorLabel(floor.floor_number)}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <svg className="w-4 h-4 inline mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21l0-12" />
                        </svg>
                        Qolalka Jiifka
                      </label>
                      <select
                        value={floor.bedrooms_on_floor}
                        onChange={(e) => updateFloor(index, 'bedrooms_on_floor', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[1,2,3,4,5,6].map(num => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
              </div>
              
              <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <svg className="w-4 h-4 inline mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11" />
                        </svg>
                        Musqulaha
                      </label>
                      <select
                        value={floor.bathrooms_on_floor}
                        onChange={(e) => updateFloor(index, 'bathrooms_on_floor', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[1,2,3,4].map(num => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
              </div>
              
              <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        💰 Qiimaha bishii ($)
                      </label>
                      <input
                        type="number"
                        value={floor.price_per_month}
                        onChange={(e) => updateFloor(index, 'price_per_month', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="100"
                        min="1"
                      />
              </div>
              </div>
              
                  {/* Amenities - Horizontal Row */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={floor.has_kitchen}
                        onChange={(e) => updateFloor(index, 'has_kitchen', e.target.checked)}
                        className="mr-1"
                      />
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                      <label className="text-sm font-medium text-gray-700">Jikada</label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={floor.has_living_room}
                        onChange={(e) => updateFloor(index, 'has_living_room', e.target.checked)}
                        className="mr-1"
                      />
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21l0-12" />
                      </svg>
                      <label className="text-sm font-medium text-gray-700">Qolka Fadhiga</label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={floor.has_master_room}
                        onChange={(e) => updateFloor(index, 'has_master_room', e.target.checked)}
                        className="mr-1"
                      />
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      <label className="text-sm font-medium text-gray-700">Master Room</label>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Xaaladda Dabaqda
            </label>
                    <select
                      value={floor.floor_status === 'available' ? 'available' : 'not_available'}
                      onChange={(e) => updateFloor(index, 'floor_status', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="available">Waa la heli karaa</option>
                      <option value="not_available">Lama heli karo</option>
                    </select>
                        </div>
                    </div>
                  ))}
            </div>
          </div>
          
          {/* Note: Floor system is handled above in the main floors section */}
          
          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-gray-200">
            <Link
              to="/owner/dashboard"
              className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-md text-gray-700 text-center hover:bg-gray-50 transition-colors"
            >
              Jooji
            </Link>
            <motion.button
              type="submit"
              disabled={loading}
              className={`w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              whileHover={{ scale: loading ? 1 : 1.05 }}
              whileTap={{ scale: loading ? 1 : 0.95 }}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Waa la sameynayaa...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Samee Liiska</span>
                </>
              )}
            </motion.button>
          </div>
        </form>
    </div>
    </motion.div>
  );
};

const EditListing = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [apartment, setApartment] = useState(null);
  const [existingFloors, setExistingFloors] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location_description: '',
    district: '',
    is_furnished: false,
    total_floors: 1,
    has_floor_system: true,
    whatsapp_number: ''
  });
  
  // Floor data state
  const [floors, setFloors] = useState([]);
  
  // Image state
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [imagesToDelete, setImagesToDelete] = useState([]);
  
  // Mogadishu districts
  const districts = [
    "Abdiaziz", "Bondhere", "Daynile", "Dharkenley", "Hamar Jajab", "Hamar Weyne",
    "Hodan", "Howl Wadaag", "Huriwa", "Karan", "Shangani", "Shibis",
    "Waberi", "Wadajir", "Warta Nabada", "Yaqshid"
  ];

  // Load existing apartment data
  useEffect(() => {
    const fetchApartmentData = async () => {
      try {
        setLoading(true);
        
        // Fetch apartment data
        const { data: apartmentData, error: apartmentError } = await supabase
          .from('apartments')
          .select(`
            *,
            apartment_images(id, storage_path, is_primary)
          `)
          .eq('id', id)
          .eq('owner_id', user.id) // Ensure user owns this apartment
          .single();
        
        if (apartmentError) throw apartmentError;
        if (!apartmentData) throw new Error('Apartment not found or you do not have permission to edit it');
        
        setApartment(apartmentData);
        
        // Set form data
        setFormData({
          title: apartmentData.title || '',
          description: apartmentData.description || '',
          location_description: apartmentData.location_description || '',
          district: apartmentData.district || '',
          is_furnished: apartmentData.is_furnished || false,
          total_floors: 1, // Will be updated when floors are loaded
          has_floor_system: apartmentData.has_floor_system || true,
          whatsapp_number: apartmentData.whatsapp_number || ''
        });
        
        // Set existing images
        if (apartmentData.apartment_images) {
          setExistingImages(apartmentData.apartment_images);
          // Find primary image index
          const primaryIndex = apartmentData.apartment_images.findIndex(img => img.is_primary);
          if (primaryIndex !== -1) {
            setPrimaryImageIndex(primaryIndex);
          }
        }
        
        // Fetch floor data
        const { data: floorsData, error: floorsError } = await supabase
          .from('apartment_floors')
          .select('*')
          .eq('apartment_id', id)
          .order('floor_number', { ascending: true });
        
        if (floorsError) throw floorsError;
        
        if (floorsData && floorsData.length > 0) {
          setExistingFloors(floorsData);
          setFloors(floorsData.map(floor => ({
            id: floor.id, // Keep track of existing floor IDs
            floor_number: floor.floor_number,
            bedrooms_on_floor: floor.bedrooms_on_floor,
            bathrooms_on_floor: floor.bathrooms_on_floor,
            has_kitchen: floor.has_kitchen,
            has_living_room: floor.has_living_room,
            price_per_month: floor.price_per_month.toString(),
            floor_description: floor.floor_description || '',
            floor_status: floor.floor_status
          })));
          
          setFormData(prev => ({ ...prev, total_floors: floorsData.length }));
        } else {
          // No floors exist, create default floor
          setFloors([{
            floor_number: 1,
            bedrooms_on_floor: 1,
            bathrooms_on_floor: 1,
            has_kitchen: true,
            has_living_room: true,
            price_per_month: '',
            floor_description: '',
            floor_status: 'available'
          }]);
        }
        
      } catch (error) {
        console.error('Error fetching apartment data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (id && user) {
      fetchApartmentData();
    }
  }, [id, user]);

  // Handle image selection
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Calculate current total images (existing + new)
    const currentTotal = existingImages.length + imageFiles.length;
    const remainingSlots = 10 - currentTotal;
    
    if (remainingSlots <= 0) {
      alert('Waxaad soo gelin kartaa ugu badan 10 sawir');
      return;
    }
    
    // Limit new files to remaining slots
    const limitedFiles = files.slice(0, remainingSlots);
    setImageFiles(prev => [...prev, ...limitedFiles]);
    
    // Create previews
    limitedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, e.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove existing image
  const removeExistingImage = (index) => {
    const imageToRemove = existingImages[index];
    setImagesToDelete(prev => [...prev, imageToRemove.id]);
    setExistingImages(prev => prev.filter((_, i) => i !== index));
    
    // Adjust primary image index if needed
    if (primaryImageIndex >= index && primaryImageIndex > 0) {
      setPrimaryImageIndex(prev => prev - 1);
    } else if (primaryImageIndex === index) {
      setPrimaryImageIndex(0);
    }
  };

  // Remove new image
  const removeNewImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    
    // Adjust primary image index for new images
    const existingCount = existingImages.length;
    const newImageIndex = index + existingCount;
    
    if (primaryImageIndex >= newImageIndex && primaryImageIndex > 0) {
      setPrimaryImageIndex(prev => prev - 1);
    } else if (primaryImageIndex === newImageIndex) {
      setPrimaryImageIndex(0);
    }
  };

  // Handle total floors change
  const handleTotalFloorsChange = (newTotal) => {
    const totalFloors = parseInt(newTotal);
    setFormData(prev => ({ ...prev, total_floors: totalFloors }));
    
    // Update floors array
    const newFloors = [];
    for (let i = 1; i <= totalFloors; i++) {
      const existingFloor = floors.find(f => f.floor_number === i);
      if (existingFloor) {
        newFloors.push(existingFloor);
      } else {
        newFloors.push({
          floor_number: i,
          bedrooms_on_floor: 1,
          bathrooms_on_floor: 1,
          has_kitchen: true,
          has_living_room: true,
          has_master_room: false,
          price_per_month: formData.price_per_month || 100,
          floor_description: '',
          floor_status: 'available'
        });
      }
    }
    setFloors(newFloors);
  };

  // Update floor data
  const updateFloor = (index, field, value) => {
    setFloors(prev => prev.map((floor, i) => 
      i === index ? { ...floor, [field]: value } : floor
    ));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      alert('Fadlan gali magaca guriga');
      return;
    }
    
    if (!formData.location_description.trim()) {
      alert('Fadlan gali meesha guriga ku yaal');
      return;
    }
    
    if (!formData.district) {
      alert('Fadlan dooro degmada');
      return;
    }
    
    // Check if we have at least one image (existing or new)
    if (existingImages.length === 0 && imageFiles.length === 0) {
      alert('Fadlan soo geli ugu yaraan hal sawir');
      return;
    }
    
    // Validate floors
    for (let i = 0; i < floors.length; i++) {
      const floor = floors[i];
      if (!floor.price_per_month || floor.price_per_month <= 0) {
        alert(`Fadlan gali qiimaha dabaqda ${i + 1}`);
        return;
      }
    }
    
    try {
      setSaving(true);
      
      // Calculate apartment-level data from floors
      const totalRooms = floors.reduce((sum, floor) => sum + parseInt(floor.bedrooms_on_floor), 0);
      const totalBathrooms = floors.reduce((sum, floor) => sum + parseInt(floor.bathrooms_on_floor), 0);
      const minPrice = Math.min(...floors.map(f => parseFloat(f.price_per_month)));
      
      // Update apartment record
      const apartmentData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        location_description: formData.location_description.trim(),
        district: formData.district,
        rooms: totalRooms,
        bathrooms: totalBathrooms,
        price_per_month: minPrice,
        is_furnished: formData.is_furnished,
        whatsapp_number: formData.whatsapp_number.trim(),
        updated_at: new Date().toISOString()
      };
      
      const { error: apartmentError } = await supabase
        .from('apartments')
        .update(apartmentData)
        .eq('id', id);
      
      if (apartmentError) throw apartmentError;
      
      // Delete marked images
      if (imagesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('apartment_images')
          .delete()
          .in('id', imagesToDelete);
        
        if (deleteError) {
          console.error('Error deleting images:', deleteError);
        }
      }
      
      // Upload new images
      if (imageFiles.length > 0) {
        const imageUploadPromises = imageFiles.map(async (file, index) => {
          const totalExistingImages = existingImages.length;
          const isPrimary = (index + totalExistingImages) === primaryImageIndex;
          return uploadApartmentImage(file, id, isPrimary);
        });
        
        const imageResults = await Promise.all(imageUploadPromises);
        
        // Check for image upload errors
        const failedUploads = imageResults.filter(result => !result.success);
        if (failedUploads.length > 0) {
          console.error('Some images failed to upload:', failedUploads);
        }
      }
      
      // Update primary image status for existing images if needed
      if (primaryImageIndex < existingImages.length) {
        // Primary is an existing image, update all existing images
        const updatePromises = existingImages.map(async (img, index) => {
          const isPrimary = index === primaryImageIndex;
          return supabase
            .from('apartment_images')
            .update({ is_primary: isPrimary })
            .eq('id', img.id);
        });
        
        await Promise.all(updatePromises);
      }
      
      // Handle floor updates
      const existingFloorIds = existingFloors.map(f => f.id);
      const currentFloorIds = floors.filter(f => f.id).map(f => f.id);
      
      // Delete floors that were removed
      const floorsToDelete = existingFloorIds.filter(id => !currentFloorIds.includes(id));
      if (floorsToDelete.length > 0) {
        const { error: deleteFloorsError } = await supabase
          .from('apartment_floors')
          .delete()
          .in('id', floorsToDelete);
        
        if (deleteFloorsError) throw deleteFloorsError;
      }
      
      // Update or insert floors
      for (const floor of floors) {
        const floorData = {
          apartment_id: id,
          floor_number: floor.floor_number,
          bedrooms_on_floor: parseInt(floor.bedrooms_on_floor),
          bathrooms_on_floor: parseInt(floor.bathrooms_on_floor),
          has_kitchen: floor.has_kitchen,
          has_living_room: floor.has_living_room,
          price_per_month: parseFloat(floor.price_per_month),
          floor_description: floor.floor_description.trim(),
          floor_status: floor.floor_status,
          is_available: floor.floor_status === 'available',
          updated_at: new Date().toISOString()
        };
        
        if (floor.id) {
          // Update existing floor
          const { error: updateError } = await supabase
            .from('apartment_floors')
            .update(floorData)
            .eq('id', floor.id);
          
          if (updateError) throw updateError;
        } else {
          // Insert new floor
          const { error: insertError } = await supabase
            .from('apartment_floors')
            .insert({ ...floorData, created_at: new Date().toISOString() });
          
          if (insertError) throw insertError;
        }
      }
      
      alert('Liiskaaga waa la cusboonaysiinayay!');
      navigate('/owner/dashboard');
      
    } catch (error) {
      console.error('Error updating apartment:', error);
      alert('Qalad ayaa dhacay. Fadlan isku day mar kale.');
    } finally {
      setSaving(false);
    }
  };

  const getFloorLabel = (floorNumber) => {
    if (floorNumber === 1) return 'Dabaqda Hoose';
    if (floorNumber === floors.length) return `Dabaqda ${floorNumber}aad (Sare)`;
    return `Dabaqda ${floorNumber}aad`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
        className="text-center py-12"
      >
        <div className="bg-red-100 text-red-700 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-2">Qalad</h2>
          <p>{error}</p>
        </div>
        <Link 
          to="/owner/dashboard"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Ku Noqo Liistada
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto"
    >
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 px-6 py-6">
          <h2 className="text-3xl font-bold text-white mb-2">🔧 Wax ka beddel Liiska</h2>
          <p className="text-gray-300 text-lg">Cusboonaysii macluumaadka gurigaaga</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-8 bg-white">
          {/* Basic Information */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
              Macluumaadka Aasaasiga ah
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Magaca Guriga *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Tusaale: Guri Qurux badan oo Hodan ku yaal"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Degmada *
                </label>
                <select
                  value={formData.district}
                  onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Dooro degmada</option>
                  {districts.map(district => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meesha Guriga ku yaal *
              </label>
              <input
                type="text"
                value={formData.location_description}
                onChange={(e) => setFormData(prev => ({ ...prev, location_description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Tusaale: Wadada Makka Al-Mukarrama, agagaarka suuqa weyn"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Faahfaahin Guriga
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Qor faahfaahin dheeraad ah oo ku saabsan guriga..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📱 WhatsApp Number
              </label>
              <input
                type="tel"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Tusaale: +252 61 1234567"
              />
              <p className="text-xs text-gray-500 mt-1">
                Dadka raba guriga waxay kugu soo waci karaan WhatsApp
              </p>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_furnished"
                checked={formData.is_furnished}
                onChange={(e) => setFormData(prev => ({ ...prev, is_furnished: e.target.checked }))}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label htmlFor="is_furnished" className="ml-2 block text-sm text-gray-700">
                Gurigu wuxuu leeyahay alaab (furnished)
              </label>
            </div>
          </div>
          
          {/* Images Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
              Sawirrada Guriga
            </h3>
            
            {/* Existing Images */}
            {existingImages.length > 0 && (
              <div>
                <h4 className="text-md font-medium text-gray-700 mb-3">Sawirrada Jira</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {existingImages.map((image, index) => (
                    <div key={image.id} className="relative">
                      <img
                        src={getImageUrl(image.storage_path)}
                        alt={`Existing ${index + 1}`}
                        className={`w-full h-24 object-cover rounded-md border-2 ${
                          index === primaryImageIndex ? 'border-green-500' : 'border-gray-200'
                        }`}
                        onError={(e) => {
                          e.target.src = '/images/placeholder-apartment.svg';
                        }}
                      />
                      {index === primaryImageIndex && (
                        <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1 rounded">
                          Ugu muhiimsan
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeExistingImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrimaryImageIndex(index)}
                        className="absolute bottom-1 left-1 bg-gray-800 bg-opacity-75 text-white text-xs px-1 rounded hover:bg-opacity-100"
                      >
                        Ka dhig ugu muhiimsan
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* New Images */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Soo geli sawirro cusub (ugu badan {10 - existingImages.length - imageFiles.length})
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={existingImages.length + imageFiles.length >= 10}
              />
              <p className="text-xs text-gray-500 mt-1">
                Wadarta sawirrada: {existingImages.length + imageFiles.length}/10
              </p>
            </div>
            
            {imagePreviews.length > 0 && (
              <div>
                <h4 className="text-md font-medium text-gray-700 mb-3">Sawirrada Cusub</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {imagePreviews.map((preview, index) => {
                    const totalIndex = existingImages.length + index;
                    return (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`New Preview ${index + 1}`}
                          className={`w-full h-24 object-cover rounded-md border-2 ${
                            totalIndex === primaryImageIndex ? 'border-green-500' : 'border-gray-200'
                          }`}
                        />
                        {totalIndex === primaryImageIndex && (
                          <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1 rounded">
                            Ugu muhiimsan
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeNewImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrimaryImageIndex(totalIndex)}
                          className="absolute bottom-1 left-1 bg-gray-800 bg-opacity-75 text-white text-xs px-1 rounded hover:bg-opacity-100"
                        >
                          Ka dhig ugu muhiimsan
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Note: Floor system is handled above in the main floors section */}
          
          {/* Note: Floor system is handled above in the main floors section */}
          
          {/* Submit Button */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <Link
              to="/owner/dashboard"
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Jooji
            </Link>
            <motion.button
              type="submit"
              disabled={saving}
              className={`px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2 ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              whileHover={{ scale: saving ? 1 : 1.05 }}
              whileTap={{ scale: saving ? 1 : 0.95 }}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Waa la cusboonaysiinayaa...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Cusboonaysii Liiska</span>
                </>
              )}
            </motion.button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState('my-listings');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Set tab based on URL
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/new-listing')) {
      setActiveTab('new-listing');
    } else if (path.includes('/edit-listing')) {
      setActiveTab('my-listings');
    } else if (path.includes('/reviews')) {
      setActiveTab('reviews');
    }
  }, [location]);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    
    // Update URL based on tab
    switch (tab) {
      case 'my-listings':
        navigate('/owner/dashboard');
        break;
      case 'reviews':
        navigate('/owner/dashboard/reviews');
        break;
      case 'new-listing':
        navigate('/owner/dashboard/new-listing');
        break;
      default:
        navigate('/owner/dashboard');
    }
  };

  return (
    <div 
      className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 relative"
      style={{
        background: `linear-gradient(rgba(5, 10, 15, 0.8), rgba(5, 10, 15, 0.92)), 
                     url('/dark-apartment-bg1.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        boxShadow: 'inset 0 0 100px rgba(0, 0, 0, 0.7)'
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/90 backdrop-blur-md shadow-2xl rounded-xl overflow-hidden border border-gray-800/10">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex" aria-label="Tabs">
              <button
                onClick={() => handleTabClick('my-listings')}
                className={`w-1/3 py-3 sm:py-4 px-1 text-center border-b-2 font-medium text-xs sm:text-sm ${
                  activeTab === 'my-listings'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="hidden sm:inline">My Listings</span>
                <span className="sm:hidden">Listings</span>
              </button>
              <button
                onClick={() => handleTabClick('reviews')}
                className={`w-1/3 py-3 sm:py-4 px-1 text-center border-b-2 font-medium text-xs sm:text-sm ${
                  activeTab === 'reviews'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Reviews
              </button>
              <button
                onClick={() => handleTabClick('new-listing')}
                className={`w-1/3 py-3 sm:py-4 px-1 text-center border-b-2 font-medium text-xs sm:text-sm ${
                  activeTab === 'new-listing'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="hidden sm:inline">Create Listing</span>
                <span className="sm:hidden">Create</span>
              </button>
            </nav>
          </div>
          <div className="p-3 sm:p-6">
            <Routes>
              <Route index element={<MyListings />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="new-listing" element={<NewListing />} />
              <Route path="edit-listing/:id" element={<EditListing />} />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  );
} 