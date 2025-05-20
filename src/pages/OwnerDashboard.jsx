import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, uploadApartmentImage } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// Utility function to get image URL from storage path
const getImageUrl = (path) => {
  if (!path) {
    console.log('No path provided, returning placeholder');
    return '/placeholder-apartment.jpg';
  }
  
  // If it's already a complete URL (for demo/sample data)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    console.log('Path is already a URL, returning as-is');
    return path;
  } 
  
  // For storage paths
  try {
    // Handle different path formats
    let normalizedPath = path;
    
    if (path.includes('apartment_images/')) {
      // If the path includes the bucket name already, extract just the path part
      console.log('Path includes bucket name, normalizing');
      normalizedPath = path.split('apartment_images/')[1];
    } else if (!path.includes('/')) {
      // If it's just a filename, assume it's in the apartments folder
      console.log('Path is just filename, adding apartments/ prefix');
      normalizedPath = `apartments/${path}`;
    }
    
    console.log('Getting public URL for normalized path:', normalizedPath);
    const { data } = supabase.storage
      .from('apartment_images')
      .getPublicUrl(normalizedPath);
    
    console.log('Generated URL:', data.publicUrl);
    return data.publicUrl || '/placeholder-apartment.jpg';
  } catch (error) {
    console.error('Error generating image URL:', error, path);
    return '/placeholder-apartment.jpg';
  }
};

// Sub-components for dashboard tabs
const MyListings = () => {
  const { user } = useAuth();
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
        <h2 className="text-xl font-semibold">My Apartment Listings</h2>
        <motion.button 
          onClick={handleCreateNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Create New Listing
        </motion.button>
      </div>
      
      {apartments.length === 0 ? (
        <motion.div 
          className="bg-yellow-50 p-6 rounded-lg text-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-gray-700 mb-4">You haven't created any apartment listings yet.</p>
          <motion.button 
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Create Your First Listing
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
                          return '/placeholder-apartment.jpg';
                        }
                      })()}
                      alt={apartment.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                      onError={(e) => {
                        console.error("Image failed to load:", e.target.src);
                        e.target.src = '/placeholder-apartment.jpg';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <p className="text-gray-500">No image</p>
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
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        apartment.status === 'approved' 
                          ? 'bg-green-100 text-green-800'
                          : apartment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {apartment.status.charAt(0).toUpperCase() + apartment.status.slice(1)}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        apartment.is_available 
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {apartment.is_available ? 'Available' : 'Not Available'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Price:</span> ${apartment.price_per_month}/month
                    </div>
                    <div className="text-sm text-gray-700 ml-4">
                      <span className="font-medium">Rooms:</span> {apartment.rooms}
                    </div>
                    <div className="text-sm text-gray-700 ml-4">
                      <span className="font-medium">Bathrooms:</span> {apartment.bathrooms}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Created:</span> {new Date(apartment.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex space-x-2">
                      <motion.button
                        onClick={() => handleEdit(apartment.id)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Edit
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
                        {apartment.is_available ? 'Mark as Unavailable' : 'Mark as Available'}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
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
      <h2 className="text-xl font-semibold mb-6">Reviews for Your Properties</h2>
      
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-md">
          <p>Error: {error}</p>
        </div>
      ) : reviews.length === 0 ? (
        <motion.div 
          className="bg-gray-50 p-6 rounded-lg text-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-gray-600">You don't have any reviews for your properties yet.</p>
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
                  <h3 className="font-semibold">{review.apartments?.title || 'Unknown Property'}</h3>
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
                  By: {review.profiles?.full_name || 'Anonymous'} | {new Date(review.created_at).toLocaleDateString()}
                </p>
              </div>
              
              <p className="text-gray-700 mb-4">{review.comment}</p>
              
              {/* Owner Replies */}
              {review.review_replies && review.review_replies.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-md mb-4">
                  <p className="font-medium text-gray-800 mb-1">Your Response:</p>
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
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Write a reply to this review..."
                    ></textarea>
                  </div>
                  <motion.button
                    onClick={() => handleReply(review.id)}
                    disabled={submitting || !replyText.trim()}
                    className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {submitting ? 'Sending...' : 'Reply to Review'}
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [district, setDistrict] = useState('');
  const [pricePerMonth, setPricePerMonth] = useState('');
  const [rooms, setRooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [isFurnished, setIsFurnished] = useState(false);
  const [images, setImages] = useState([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  
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
  
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newImages = files.map(file => ({
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
        type: file.type
      }));
      setImages(prev => [...prev, ...newImages]);
    }
  };
  
  const removeImage = (index) => {
    const newImages = [...images];
    // Revoke the object URL to avoid memory leaks
    URL.revokeObjectURL(newImages[index].preview);
    newImages.splice(index, 1);
    setImages(newImages);
    
    // Adjust primary image index if needed
    if (primaryImageIndex >= newImages.length) {
      setPrimaryImageIndex(Math.max(0, newImages.length - 1));
    } else if (index < primaryImageIndex) {
      setPrimaryImageIndex(primaryImageIndex - 1);
    }
  };
  
  const setPrimaryImage = (index) => {
    setPrimaryImageIndex(index);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (images.length < 4) {
      setError('Please add at least 4 images of the apartment');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setUploadProgress(0);
      
      // 1. Insert apartment record
      const { data: apartment, error: apartmentError } = await supabase
        .from('apartments')
        .insert({
          title,
          description,
          location_description: locationDescription,
          district: district,
          price_per_month: parseFloat(pricePerMonth),
          rooms: parseInt(rooms),
          bathrooms: parseInt(bathrooms),
          is_furnished: isFurnished,
          is_available: true,
          status: 'pending', // All new listings start with pending status
          owner_id: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (apartmentError) throw apartmentError;
      
      // Progress: 20% complete after apartment creation
      setUploadProgress(20);
      
      // 2. Upload images and create image records
      const apartmentId = apartment.id;
      let uploadedCount = 0;
      const totalImages = images.length;
      const progressPerImage = 75 / totalImages; // Allocate 75% of progress to image uploads (20-95%)
      
      let primaryImagePath = null;
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const isPrimary = i === primaryImageIndex;
        
        try {
          // Use the new utility function to upload the image
          const { success, filePath, error } = await uploadApartmentImage(
            image.file,
            apartmentId,
            isPrimary
          );
          
          if (!success) {
            console.error(`Error processing image ${i}:`, error);
            continue;
          }
          
          // Store primary image path for the apartment update
          if (isPrimary) {
            primaryImagePath = filePath;
          }
          
          uploadedCount++;
          // Calculate progress: 20% base + proportional progress for each image
          const newProgress = Math.round(20 + (progressPerImage * uploadedCount));
          setUploadProgress(newProgress);
        } catch (error) {
          console.error(`Error processing image ${i}:`, error);
          // Continue with next image instead of stopping the whole process
          continue;
        }
      }
      
      // If we have a primary image, update the apartment record with it
      if (primaryImagePath) {
        try {
          const { error: updateError } = await supabase
            .from('apartments')
            .update({ primary_image_path: primaryImagePath })
            .eq('id', apartmentId);
            
          if (updateError) {
            console.log('Error updating primary image path:', updateError);
          }
        } catch (err) {
          console.error('Error setting primary image on apartment:', err);
        }
      }
      
      // Set to 100% when completely done
      setUploadProgress(100);
      setSubmitSuccess(true);
      
      // Navigate back to listings page after a short delay
      setTimeout(() => {
        navigate('/owner/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('Error creating listing:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Diiwaan-gelin Guryaha Cusub</h2>
        <Link to="/owner/dashboard" className="text-blue-600 hover:underline flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Ku Noqo Liistada
        </Link>
      </div>
      
      {submitSuccess ? (
        <div className="bg-green-100 text-green-700 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-lg mb-2">Si Guul leh ayaa loo Diiwaan-geliyay!</h3>
          <p>Diiwaan-gelintu waxay u gudbineysaa ansixinta. Marka la ogolaado, waxay u muuqan doontaa kireystayaasha suurtagalka ah.</p>
          <div className="mt-4">
            <Link to="/owner/dashboard" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Ku Noqo Bogga Maamulka
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          {/* Steps indicator */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">1</div>
                <span className="text-xs mt-1 text-blue-600 font-medium">Macluumaadka Aasaasiga</span>
              </div>
              <div className="flex-grow h-1 bg-blue-200 mx-2"></div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">2</div>
                <span className="text-xs mt-1 text-blue-600 font-medium">Goobta</span>
              </div>
              <div className="flex-grow h-1 bg-blue-200 mx-2"></div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">3</div>
                <span className="text-xs mt-1 text-blue-600 font-medium">Sawirrada</span>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {error && (
              <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
                <p>{error}</p>
              </div>
            )}
            
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">1. Macluumaadka Aasaasiga ah</h3>
              
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                      Cinwaanka Guriga *
                    </label>
                    <input
                      id="title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="tusaale: Guri Casri ah oo 2 qol leh oo ku yaala Hodan"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                      Kirada Bishii (USD) *
                    </label>
                    <input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricePerMonth}
                      onChange={(e) => setPricePerMonth(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="tusaale: 300"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="rooms" className="block text-sm font-medium text-gray-700 mb-1">
                      Qolalka jiifka *
                    </label>
                    <input
                      id="rooms"
                      type="number"
                      min="1"
                      value={rooms}
                      onChange={(e) => setRooms(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="bathrooms" className="block text-sm font-medium text-gray-700 mb-1">
                      Musqulaha *
                    </label>
                    <input
                      id="bathrooms"
                      type="number"
                      min="1"
                      step="0.5"
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={isFurnished}
                        onChange={(e) => setIsFurnished(e.target.checked)}
                        className="h-5 w-5 text-blue-600 rounded"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Alaab leh</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">2. Faahfaahinta Goobta</h3>
              
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="district" className="block text-sm font-medium text-gray-700 mb-1">
                      Degmada *
                    </label>
                    <select
                      id="district"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Dooro degmo</option>
                      {districts.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                      Goobta Faahfaahsan *
                    </label>
                    <input
                      id="location"
                      type="text"
                      value={locationDescription}
                      onChange={(e) => setLocationDescription(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="tusaale: U dhow Peace Garden, 2 block ka fog Bakaaraha"
                      required
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Ku dar calaamado gaar ah ama waddooyinka si aad uga caawiso kireystayaasha inay si fudud u helaan hantidaada
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">3. Sharraxaad</h3>
              
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Sharraxaada Guriga *
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Gurigaaga si faahfaahsan u sharax. Ku dar macluumaad ku saabsan adeegyada, xaafadda, xarumaha dhow, iwm."
                  required
                ></textarea>
              </div>
            </div>
            
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">4. Sawirrada Guriga</h3>
              
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Soo Rar Sawirada * (Ugu yaraan 4 sawir ayaa loo baahan yahay)
                  </label>
                  <p className="text-sm text-gray-500 mb-3">
                    Riix sawir si aad uga dhigto sawirka koowaad (kaas oo marka hore la tusi doono)
                  </p>
                  
                  <div className="flex items-center space-x-4 mb-4">
                    <label className="cursor-pointer bg-blue-50 text-blue-600 px-4 py-3 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="font-medium">Ku Dar Sawiro</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    <span className={`text-sm ${images.length < 4 ? 'text-red-500 font-medium' : 'text-green-600'}`}>
                      {images.length} {images.length === 1 ? 'sawir' : 'sawir'} la doortay
                      {images.length < 4 && ` (waxaa loo baahan yahay ${4 - images.length} oo kale)`}
                    </span>
                  </div>
                </div>
                
                {images.length > 0 && (
                  <div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
                      {images.map((image, index) => (
                        <div 
                          key={index} 
                          onClick={() => setPrimaryImage(index)}
                          className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                            index === primaryImageIndex ? 'border-blue-500 shadow-lg transform scale-105' : 'border-gray-200'
                          }`}
                        >
                          <img
                            src={image.preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                            <div className="absolute top-1 right-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeImage(index);
                                }}
                                className="bg-white rounded-full p-1 text-red-500 hover:text-red-700 shadow-md"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                                </svg>
                              </button>
                            </div>
                            {index === primaryImageIndex && (
                              <span className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-xs py-1 text-center">
                                Sawirka Koowaad
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                type="submit"
                disabled={loading || images.length < 4}
                className={`px-6 py-3 text-white rounded-md relative ${
                  loading || images.length < 4 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } transition-colors`}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>La abuurayaa... {uploadProgress}%</span>
                  </div>
                ) : (
                  'Diiwaan-geli'
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

const EditListing = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Form state
  const [apartment, setApartment] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [pricePerMonth, setPricePerMonth] = useState('');
  const [rooms, setRooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [isFurnished, setIsFurnished] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [primaryImageId, setPrimaryImageId] = useState(null);
  const [imagesToDelete, setImagesToDelete] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch apartment data
  useEffect(() => {
    const fetchApartment = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('apartments')
          .select(`
            *,
            apartment_images(id, storage_path, is_primary)
          `)
          .eq('id', id)
          .eq('owner_id', user.id)
          .single();
        
        if (error) throw error;
        
        if (!data) {
          throw new Error('Apartment not found or you do not have permission to edit it');
        }
        
        setApartment(data);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setLocationDescription(data.location_description || '');
        setPricePerMonth(data.price_per_month.toString() || '');
        setRooms(data.rooms || 1);
        setBathrooms(data.bathrooms || 1);
        setIsFurnished(data.is_furnished || false);
        setIsAvailable(data.is_available || true);
        
        if (data.apartment_images && data.apartment_images.length > 0) {
          setExistingImages(data.apartment_images);
          
          // Find primary image
          const primaryImage = data.apartment_images.find(img => img.is_primary);
          if (primaryImage) {
            setPrimaryImageId(primaryImage.id);
          }
        }
      } catch (error) {
        console.error('Error fetching apartment:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchApartment();
  }, [id, user.id]);

  const handleNewImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newImagesArray = files.map(file => ({
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
        type: file.type
      }));
      setNewImages(prev => [...prev, ...newImagesArray]);
    }
  };
  
  const removeNewImage = (index) => {
    const newImagesArray = [...newImages];
    // Revoke the object URL to avoid memory leaks
    URL.revokeObjectURL(newImagesArray[index].preview);
    newImagesArray.splice(index, 1);
    setNewImages(newImagesArray);
  };
  
  const removeExistingImage = (imageId) => {
    setImagesToDelete(prev => [...prev, imageId]);
    setExistingImages(prev => prev.filter(img => img.id !== imageId));
    
    // If the primary image is being deleted, set a new primary image
    if (imageId === primaryImageId) {
      const remainingImages = existingImages.filter(img => img.id !== imageId);
      if (remainingImages.length > 0) {
        setPrimaryImageId(remainingImages[0].id);
      } else if (newImages.length > 0) {
        setPrimaryImageId(null); // Will set one of the new images as primary
      } else {
        setPrimaryImageId(null);
      }
    }
  };
  
  const setPrimaryExistingImage = (imageId) => {
    setPrimaryImageId(imageId);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (existingImages.length === 0 && newImages.length === 0) {
      setError('Please add at least one image of the apartment');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      setUploadProgress(0);
      
      // 1. Update apartment record
      const { error: apartmentError } = await supabase
        .from('apartments')
        .update({
          title,
          description,
          location_description: locationDescription,
          price_per_month: parseFloat(pricePerMonth),
          rooms: parseInt(rooms),
          bathrooms: parseInt(bathrooms),
          is_furnished: isFurnished,
          is_available: isAvailable,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (apartmentError) throw apartmentError;
      
      // Base progress: 10% after apartment update
      setUploadProgress(10);
      
      // 2. Delete images that should be removed
      if (imagesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('apartment_images')
          .delete()
          .in('id', imagesToDelete);
        
        if (deleteError) throw deleteError;
      }
      
      // Track the primary image path
      let primaryImagePath = null;
      
      // Progress: 20% after deletions
      setUploadProgress(20);
      
      // 3. Set primary image for existing images
      if (primaryImageId && existingImages.length > 0) {
        // First, set all to not primary
        const { error: resetPrimaryError } = await supabase
          .from('apartment_images')
          .update({ is_primary: false })
          .eq('apartment_id', id);
        
        if (resetPrimaryError) throw resetPrimaryError;
        
        // Then set the selected image as primary
        const { error: setPrimaryError } = await supabase
          .from('apartment_images')
          .update({ is_primary: true })
          .eq('id', primaryImageId);
        
        if (setPrimaryError) throw setPrimaryError;
        
        // Get the path of the primary image for the apartment record
        const primaryImage = existingImages.find(img => img.id === primaryImageId);
        if (primaryImage) {
          primaryImagePath = primaryImage.storage_path;
        }
      }
      
      // Progress: 30% after setting primary
      setUploadProgress(30);
      
      // 4. Upload and add new images
      if (newImages.length > 0) {
        let uploadedCount = 0;
        const progressPerImage = 65 / newImages.length; // Allocate 65% of remaining progress (30-95%)
        const shouldSetNewPrimary = existingImages.length === 0 || (!primaryImageId && imagesToDelete.length === existingImages.length);
        
        for (let i = 0; i < newImages.length; i++) {
          const image = newImages[i];
          const isPrimary = shouldSetNewPrimary && i === 0;
          
          try {
            // Use the new utility function to upload the image
            const { success, filePath, error } = await uploadApartmentImage(
              image.file,
              id,
              isPrimary
            );
            
            if (!success) {
              console.error(`Error processing image ${i}:`, error);
              continue;
            }
            
            // If this is the primary image and we don't have one from existing images
            if (isPrimary && !primaryImagePath) {
              primaryImagePath = filePath;
            }
            
            uploadedCount++;
            // Calculate progress: 30% base + proportional progress for each image
            const newProgress = Math.round(30 + (progressPerImage * uploadedCount));
            setUploadProgress(newProgress);
          } catch (error) {
            console.error(`Error processing image ${i}:`, error);
            continue;
          }
        }
      }
      
      // Update the apartment with the primary image path if available
      if (primaryImagePath) {
        try {
          const { error: updateError } = await supabase
            .from('apartments')
            .update({ primary_image_path: primaryImagePath })
            .eq('id', id);
            
          if (updateError) {
            console.log('Error updating primary image path:', updateError);
          }
        } catch (err) {
          console.error('Error setting primary image on apartment:', err);
        }
      }
      
      // Set to 100% when completely done
      setUploadProgress(100);
      setSubmitSuccess(true);
      
      // Navigate back to listings page after a short delay
      setTimeout(() => {
        navigate('/owner/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('Error updating listing:', error);
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (error && !apartment) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded-md">
        <p>{error}</p>
        <Link to="/owner/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Edit Apartment Listing</h2>
        <Link to="/owner/dashboard" className="text-blue-600 hover:underline">
          &larr; Back to Listings
        </Link>
      </div>
      
      {submitSuccess ? (
        <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-6">
          <h3 className="font-semibold text-lg mb-2">Listing Updated Successfully!</h3>
          <p>Your changes have been saved. If you made significant changes, the listing may need to be re-approved.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 p-6">
          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
              <p>{error}</p>
            </div>
          )}
          
          <div className="mb-6">
            <h3 className="text-lg font-medium border-b border-gray-200 pb-2 mb-4">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Apartment Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Rent (USD) *
                </label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricePerMonth}
                  onChange={(e) => setPricePerMonth(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="rooms" className="block text-sm font-medium text-gray-700 mb-1">
                  Bedrooms *
                </label>
                <input
                  id="rooms"
                  type="number"
                  min="1"
                  value={rooms}
                  onChange={(e) => setRooms(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="bathrooms" className="block text-sm font-medium text-gray-700 mb-1">
                  Bathrooms *
                </label>
                <input
                  id="bathrooms"
                  type="number"
                  min="1"
                  step="0.5"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="flex items-end">
                <div>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={isFurnished}
                      onChange={(e) => setIsFurnished(e.target.checked)}
                      className="h-5 w-5 text-blue-600 rounded"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Alaab leh</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Apartment Description *
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            ></textarea>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium border-b border-gray-200 pb-2 mb-4">Apartment Images</h3>
            
            {/* Existing Images */}
            {existingImages.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Current Images</h4>
                <p className="text-sm text-gray-500 mb-3">Click on an image to set it as the primary image</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {existingImages.map((image) => (
                    <div 
                      key={image.id} 
                      className={`relative rounded-lg overflow-hidden border-2 ${
                        image.id === primaryImageId ? 'border-blue-500' : 'border-gray-200'
                      }`}
                    >
                      <img
                        src={getImageUrl(image.storage_path)}
                        alt="Apartment"
                        className="w-full h-24 object-cover"
                        onClick={() => setPrimaryExistingImage(image.id)}
                        onError={(e) => {
                          console.error("Image failed to load:", e.target.src);
                          e.target.src = '/placeholder-apartment.jpg';
                        }}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                        <div className="absolute top-0 right-0 p-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeExistingImage(image.id);
                            }}
                            className="bg-white rounded-full p-1 text-red-500 hover:text-red-700"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        {image.id === primaryImageId && (
                          <span className="absolute bottom-0 left-0 bg-blue-500 text-white px-2 py-1 text-xs">
                            Primary
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* New Images */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Add New Images</h4>
              
              <div className="flex items-center space-x-4 mb-4">
                <label className="cursor-pointer bg-blue-100 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors">
                  <span>Add Images</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleNewImageChange}
                    className="hidden"
                  />
                </label>
                <span className="text-sm text-gray-500">
                  {newImages.length} new {newImages.length === 1 ? 'image' : 'images'} selected
                </span>
              </div>
              
              {newImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
                  {newImages.map((image, index) => (
                    <div 
                      key={index} 
                      className="relative rounded-lg overflow-hidden border-2 border-gray-200"
                    >
                      <img
                        src={image.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover"
                      />
                      <div className="absolute top-0 right-0 p-1">
                        <button
                          type="button"
                          onClick={() => removeNewImage(index)}
                          className="bg-white rounded-full p-1 text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <button
              type="submit"
              disabled={submitting}
              className={`px-6 py-3 text-white rounded-md relative ${
                submitting 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } transition-colors`}
            >
              {submitting ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Updating... {uploadProgress > 0 ? `${uploadProgress}%` : ''}</span>
                </div>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
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
                className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'my-listings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                My Listings
              </button>
              <button
                onClick={() => handleTabClick('reviews')}
                className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'reviews'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Reviews
              </button>
              <button
                onClick={() => handleTabClick('new-listing')}
                className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'new-listing'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Create Listing
              </button>
            </nav>
          </div>
          <div className="p-6">
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