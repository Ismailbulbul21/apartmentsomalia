import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { getImageUrl } from '../utils/imageUtils';

// Image viewer modal component
const ImageViewerModal = ({ images, activeIndex, onClose, onPrev, onNext }) => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe) {
      onNext();
    }
    
    if (isRightSwipe) {
      onPrev();
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrev, onNext]);
  
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);
  
  if (!images || images.length === 0) return null;
  
  const currentImage = images[activeIndex];
  const imageUrl = currentImage && currentImage.storage_path 
    ? getImageUrl(currentImage.storage_path) 
    : '/images/placeholder-apartment.svg';
  
  return (
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="relative w-full h-full flex flex-col justify-center items-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button 
          className="absolute top-4 right-4 z-10 text-white bg-black bg-opacity-50 rounded-full p-2"
          onClick={onClose}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div 
          className="relative w-full h-full flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <img 
            src={imageUrl} 
            alt={`Image ${activeIndex + 1}`}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/images/placeholder-apartment.svg';
            }}
          />
        </div>
        
        {images.length > 1 && (
          <>
            <button 
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full"
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full"
              onClick={(e) => { e.stopPropagation(); onNext(); }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm">
              {activeIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default function ApartmentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [apartment, setApartment] = useState(null);
  const [apartmentFloors, setApartmentFloors] = useState([]);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  // Fetch apartment data
  useEffect(() => {
    const fetchApartment = async () => {
      try {
        setLoading(true);
        
          const { data: apartmentData, error: apartmentError } = await supabase
            .from('apartments')
            .select(`
              *,
              apartment_images(id, storage_path, is_primary)
            `)
            .eq('id', id)
            .eq('status', 'approved')
            .single();
          
        if (apartmentError) throw apartmentError;
        if (!apartmentData) throw new Error('Apartment not found');
        
        // Process images
          if (!apartmentData.apartment_images) {
          const { data: imagesData } = await supabase
              .from('apartment_images')
              .select('*')
              .eq('apartment_id', id);
          apartmentData.apartment_images = imagesData || [];
        }
        
        apartmentData.apartment_images = apartmentData.apartment_images.filter(img => 
          img && img.storage_path && img.storage_path.trim() !== ''
        );
        
          setApartment(apartmentData);
          
        // Fetch floor data - all apartments now have floors
        const { data: floorsData, error: floorsError } = await supabase
          .from('apartment_floors')
          .select('*')
          .eq('apartment_id', id)
          .order('floor_number', { ascending: true });
          
        if (!floorsError && floorsData) {
          setApartmentFloors(floorsData);
        }
        
        // Fetch owner
          if (apartmentData.owner_id) {
          const { data: ownerData } = await supabase
                .from('profiles')
                .select('id, full_name, business_name, whatsapp_number, business_phone')
                .eq('id', apartmentData.owner_id)
                .single();
                
          if (ownerData) setOwner(ownerData);
        }
        
        // Fetch reviews
        const { data: reviewsData } = await supabase
            .from('reviews')
            .select('*')
            .eq('apartment_id', id)
            .order('created_at', { ascending: false });
        
        if (reviewsData && reviewsData.length > 0) {
          const userIds = [...new Set(reviewsData.map(review => review.user_id))];
          
          const { data: userProfiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
            
          const { data: repliesData } = await supabase
              .from('review_replies')
              .select('*')
              .in('review_id', reviewsData.map(r => r.id));
              
          const profileMap = (userProfiles || []).reduce((map, profile) => {
            map[profile.id] = profile;
            return map;
          }, {});
          
            const enrichedReviews = reviewsData.map(review => ({
              ...review,
              profiles: profileMap[review.user_id] || null,
            review_replies: (repliesData || []).filter(reply => reply.review_id === review.id)
            }));
            
            setReviews(enrichedReviews);
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

  // Add listener to refresh data when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, refresh apartment and floor data
        const refreshData = async () => {
          try {
            // Refresh apartment data
            const { data: apartmentData } = await supabase
              .from('apartments')
              .select('is_available')
              .eq('id', id)
              .single();
              
            if (apartmentData) {
              setApartment(prev => ({ ...prev, is_available: apartmentData.is_available }));
            }
            
            // Refresh floor data
            const { data: floorsData } = await supabase
              .from('apartment_floors')
              .select('*')
              .eq('apartment_id', id)
              .order('floor_number', { ascending: true });
              
            if (floorsData) {
              setApartmentFloors(floorsData);
            }
          } catch (error) {
            console.error('Error refreshing data:', error);
          }
        };
        
        refreshData();
      }
    };

    const handleFocus = () => {
      // Page gained focus, refresh data
      handleVisibilityChange();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [id]);

  // Add periodic refresh every 30 seconds when page is visible
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!document.hidden) {
        try {
          // Refresh floor data
          const { data: floorsData } = await supabase
            .from('apartment_floors')
            .select('*')
            .eq('apartment_id', id)
            .order('floor_number', { ascending: true });
            
          if (floorsData) {
            setApartmentFloors(floorsData);
          }
        } catch (error) {
          console.error('Error in periodic refresh:', error);
        }
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [id]);

  // Handle navigation to messages
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
      const { data: convData, error: convError } = await supabase.rpc('generate_conversation_id', {
        p_user_id_1: user.id,
        p_user_id_2: owner.id,
        p_apartment_id: apartment.id
      });
      
      if (convError) throw convError;
      
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

  // Manual refresh function
  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      
      // Refresh apartment data
      const { data: apartmentData } = await supabase
        .from('apartments')
        .select('is_available')
        .eq('id', id)
        .single();
        
      if (apartmentData) {
        setApartment(prev => ({ ...prev, is_available: apartmentData.is_available }));
      }
      
      // Refresh floor data
      const { data: floorsData } = await supabase
        .from('apartment_floors')
        .select('*')
        .eq('apartment_id', id)
        .order('floor_number', { ascending: true });
        
      if (floorsData) {
        setApartmentFloors(floorsData);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle floor status change (for owners)
  const handleFloorStatusChange = async (floorId, newStatus) => {
    if (!user || user.id !== apartment.owner_id) return;
    
    try {
      const { error } = await supabase
        .from('apartment_floors')
        .update({ floor_status: newStatus })
        .eq('id', floorId);
      
      if (error) throw error;
      
      // Update local state
      setApartmentFloors(prev => 
        prev.map(floor => 
          floor.id === floorId 
            ? { ...floor, floor_status: newStatus }
            : floor
        )
      );
    } catch (error) {
      console.error('Error updating floor status:', error);
      alert('Failed to update floor status. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 text-lg font-medium">Waa la soo raraya macluumaadka guriga...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center border border-red-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">⚠️ Qalad</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link 
              to="/" 
              className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m0 0v11a2 2 0 01-2 2H5" />
              </svg>
              Ku laabo Bogga Hore
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!apartment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">🏠 Guriga Lama Helin</h2>
            <p className="text-gray-600 mb-6">Ma heli karno guriga aad raadineyso.</p>
            <Link 
              to="/" 
              className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m0 0v11a2 2 0 01-2 2H5" />
              </svg>
              Ku laabo Bogga Hore
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // Process images
  let primaryImage = null;
  let firstImage = null;
  let currentImage = null;
  
  if (apartment.apartment_images && Array.isArray(apartment.apartment_images) && apartment.apartment_images.length > 0) {
    primaryImage = apartment.apartment_images.find(img => img && img.is_primary && img.storage_path && img.storage_path.trim() !== '');
    const firstValidImage = apartment.apartment_images.find(img => img && img.storage_path && img.storage_path.trim() !== '');
    firstImage = firstValidImage || null;
    
    currentImage = activeImageIndex < apartment.apartment_images.length 
      ? apartment.apartment_images[activeImageIndex] 
      : null;
      
    if (currentImage && (!currentImage.storage_path || currentImage.storage_path.trim() === '')) {
      currentImage = null;
    }
  }
  
  currentImage = currentImage || primaryImage || firstImage;
  
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

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(price);
  };

  const getFloorLabel = (floorNumber, totalFloors) => {
    if (floorNumber === 1) return 'Dabaqda 1';
    if (floorNumber === totalFloors) return `Dabaqda ${floorNumber}aad (Sare)`;
    return `Dabaqda ${floorNumber}aad`;
  };

  const getStatusBadge = (floor) => {
    switch (floor.floor_status) {
      case 'available':
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-green-100 text-green-800 border border-green-200">
            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            La Kireyn Karaa
          </span>
        );
      case 'occupied':
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-800 border border-red-200">
            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            La Kireeyay
          </span>
        );
      case 'not_available':
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Lama Heli Karo
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Dayactir
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            Lama Heli Karo
          </span>
        );
    }
  };

  // Check if building has any available floors
  const hasAvailableFloors = () => {
    return apartmentFloors.some(floor => floor.floor_status === 'available');
  };

  // Get building availability status
  const getBuildingAvailabilityBadge = () => {
    const isAvailable = hasAvailableFloors();
    
    if (isAvailable) {
      return (
        <span className="inline-flex items-center px-4 py-2 rounded-full text-lg font-bold bg-green-100 text-green-800 border-2 border-green-300">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          ✅ La Heli Karaa
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-4 py-2 rounded-full text-lg font-bold bg-red-100 text-red-800 border-2 border-red-300">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          ❌ Lama Heli Karo
        </span>
      );
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header Section - Image Left, Info Right */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* Left Side - Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
              <div className="aspect-[4/3] relative cursor-pointer" onClick={() => setShowImageViewer(true)}>
                {currentImage && currentImage.storage_path && currentImage.storage_path.trim() !== '' ? (
                  <>
                    <img 
                      src={getImageUrl(currentImage.storage_path)} 
                      alt={apartment.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/images/placeholder-apartment.svg';
                      }}
                    />
                    
                    {/* Image navigation arrows */}
                    {apartment.apartment_images && apartment.apartment_images.length > 1 && (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newIndex = activeImageIndex === 0 
                              ? apartment.apartment_images.length - 1 
                              : activeImageIndex - 1;
                            setActiveImageIndex(newIndex);
                          }}
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white p-3 rounded-full transition-all duration-200"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newIndex = activeImageIndex === apartment.apartment_images.length - 1 
                              ? 0 
                              : activeImageIndex + 1;
                            setActiveImageIndex(newIndex);
                          }}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white p-3 rounded-full transition-all duration-200"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )}
                    
                    {/* View Gallery Button */}
                    <button
                      onClick={() => setShowImageViewer(true)}
                      className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white px-4 py-2 rounded-full flex items-center space-x-2 transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium">
                        {apartment.apartment_images?.length || 1} Sawir
                      </span>
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-700">
                    <svg className="w-16 h-16 text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400 text-lg">Sawir ma jiro</p>
                  </div>
                )}
              </div>
              
              {/* Thumbnail strip */}
              {apartment.apartment_images && Array.isArray(apartment.apartment_images) && apartment.apartment_images.length > 1 && (
                <div className="bg-gray-900 p-4 border-t border-gray-700">
                  <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                    {apartment.apartment_images.map((image, index) => (
                      <button
                        key={image?.id || `thumb-${index}`}
                        onClick={() => setActiveImageIndex(index)}
                        className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all duration-200 ${
                          activeImageIndex === index ? 'ring-2 ring-blue-500 shadow-lg' : 'ring-1 ring-gray-600 hover:ring-gray-500'
                        }`}
                      >
                        {image && image.storage_path && image.storage_path.trim() !== '' ? (
                          <img 
                            src={getImageUrl(image.storage_path)} 
                            alt={`Thumbnail ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/images/placeholder-apartment.svg';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-700">
                            <span className="text-xs text-gray-400">No img</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Side - Property Information */}
          <div className="space-y-6">
            {/* Property Title & Basic Info */}
            <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                {apartment.title}
              </h1>
              <p className="text-xl text-gray-300 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {apartment.location_description}
              </p>
              
              {/* Rating & Reviews */}
              <div className="flex items-center mb-6">
                <div className="flex items-center mr-4">
                  {renderStars(getAverageRating())}
                  <span className="ml-2 text-lg text-yellow-400 font-bold">
                    {getAverageRating()}
                  </span>
                </div>
                <span className="text-gray-400">•</span>
                <span className="ml-4 text-gray-300 font-medium">
                  {reviews.length} {reviews.length === 1 ? 'faallo' : 'faallo'}
                </span>
              </div>
              
              {/* Availability Status */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-4">Xaaladda Helitaanka</h3>
                <div className="flex items-center space-x-4 mb-4">
                  {getBuildingAvailabilityBadge()}
                </div>
                
                <div className="text-gray-300 text-lg">
                  <span className="font-bold text-2xl text-green-400">
                    {apartmentFloors.filter(f => f.floor_status === 'available').length}
                  </span>
                  <span> ka mid ah </span>
                  <span className="font-bold text-xl text-white">{apartmentFloors.length}</span>
                  <span> dabaq ayaa la heli karaa</span>
                </div>
                
                {/* Price Range Summary */}
                {apartmentFloors.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-900 rounded-xl border border-gray-600">
                    <div className="text-center">
                      <div className="text-lg text-gray-300 mb-2">Qiimaha Dabaqyada:</div>
                      <div className="text-2xl font-bold text-green-400">
                        {formatPrice(Math.min(...apartmentFloors.map(f => f.price_per_month)))}
                        {apartmentFloors.length > 1 && 
                          Math.min(...apartmentFloors.map(f => f.price_per_month)) !== 
                          Math.max(...apartmentFloors.map(f => f.price_per_month)) && (
                          <span className="text-gray-400"> - {formatPrice(Math.max(...apartmentFloors.map(f => f.price_per_month)))}</span>
                        )}
                      </div>
                      <div className="text-gray-400">bishii</div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Quick Contact Buttons - ALWAYS VISIBLE */}
              <div className="space-y-3">
                {/* WhatsApp Button - Always show if WhatsApp number exists */}
                {(apartment.whatsapp_number || (owner && owner.whatsapp_number)) && (
                  <a 
                    href={`https://wa.me/${(apartment.whatsapp_number || owner.whatsapp_number).replace(/\D/g, '')}?text=Salaan, waxaan xiiseynayaa gurigaaga: ${apartment.title}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-bold text-lg"
                  >
                    <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    </svg>
                    📱 WhatsApp Contact
                  </a>
                )}
                
                {/* Message Button - Only for logged in users who are not owners */}
                {user && user.id !== apartment.owner_id && (
                  <button 
                    onClick={handleNavigateToMessages}
                    className="w-full flex items-center justify-center px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-bold text-lg"
                  >
                    <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Fariin Dir
                  </button>
                )}
              </div>
            </div>
            
            {/* Owner Info Card */}
            {(apartment.display_owner_name || owner) && (
              <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Mulkiilaha Guriga
                </h3>
                
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold mr-4">
                    {(apartment.display_owner_name || owner?.full_name)?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <p className="font-bold text-lg text-white">
                      {apartment.display_owner_name || owner?.full_name || "Mulkiile"}
                    </p>
                    {owner?.business_name && !apartment.display_owner_name && (
                      <p className="text-gray-400">{owner.business_name}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Floors Section - Full Width Below */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
              🏢 Dabaqyada Guriga
            </h2>
            <p className="text-gray-400 text-lg">Dooro dabaqda aad rabto</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apartmentFloors.map((floor) => (
              <motion.div 
                key={floor.id} 
                className={`bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border-2 transition-all duration-300 hover:shadow-3xl ${
                  floor.floor_status === 'available' 
                    ? 'border-green-500 hover:border-green-400 hover:shadow-green-500/20' 
                    : 'border-gray-600 opacity-75'
                }`}
                whileHover={{ y: -5, scale: 1.02 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Floor Header */}
                <div className={`p-4 ${
                  floor.floor_status === 'available' 
                    ? 'bg-gradient-to-r from-green-600/20 to-blue-600/20' 
                    : 'bg-gray-700'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        {getFloorLabel(floor.floor_number, apartmentFloors.length)}
                      </h3>
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-600">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-400 mb-1">
                            {formatPrice(floor.price_per_month)}
                          </div>
                          <div className="text-sm text-gray-400 font-medium">bishii</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      {getStatusBadge(floor)}
                    </div>
                  </div>
                </div>
                
                {/* Floor Details */}
                <div className="p-6">
                  {/* Room Info Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-700 rounded-xl">
                      <div className="flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21l0-12" />
                        </svg>
                        <div className="text-2xl font-bold text-blue-400">{floor.bedrooms_on_floor}</div>
                      </div>
                      <div className="text-sm text-gray-300 font-medium">Qolalka Jiifka</div>
                    </div>
                    <div className="text-center p-3 bg-gray-700 rounded-xl">
                      <div className="flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11" />
                        </svg>
                        <div className="text-2xl font-bold text-blue-400">{floor.bathrooms_on_floor}</div>
                      </div>
                      <div className="text-sm text-gray-300 font-medium">Musqulaha</div>
                    </div>
                  </div>

                  {/* Amenities - Horizontal Row */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <div className="flex items-center space-x-2 px-3 py-2 bg-gray-700 rounded-lg">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        floor.has_kitchen ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                        </svg>
                      </div>
                      <span className={`text-sm font-medium ${
                        floor.has_kitchen ? 'text-green-300' : 'text-red-300'
                      }`}>
                        Jikada
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 px-3 py-2 bg-gray-700 rounded-lg">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        floor.has_living_room ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21l0-12" />
                        </svg>
                      </div>
                      <span className={`text-sm font-medium ${
                        floor.has_living_room ? 'text-green-300' : 'text-red-300'
                      }`}>
                        Qolka Fadhiga
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 px-3 py-2 bg-gray-700 rounded-lg">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        floor.has_master_room ? 'bg-purple-500' : 'bg-red-500'
                      }`}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                      <span className={`text-sm font-medium ${
                        floor.has_master_room ? 'text-purple-300' : 'text-red-300'
                      }`}>
                        Master Room
                      </span>
                    </div>
                  </div>
                  
                  {/* Floor Description */}
                  {floor.floor_description && (
                    <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-300">{floor.floor_description}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {user && user.id === apartment.owner_id ? (
                    // Owner controls
                    <div className="space-y-3">
                      <div className="bg-gray-600 rounded-lg p-3">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Bedel Xaaladda Dabaqan:
                        </label>
                        <select
                          value={floor.floor_status}
                          onChange={(e) => handleFloorStatusChange(floor.id, e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="available">La Kireyn Karaa</option>
                          <option value="occupied">La Kireeyay</option>
                          <option value="not_available">Lama Heli Karo</option>
                          <option value="maintenance">Dayactir</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    // Contact buttons - ALWAYS SHOW regardless of availability
                    <div className="space-y-3">
                      {/* WhatsApp Button - Always visible */}
                      {(apartment.whatsapp_number || (owner && owner.whatsapp_number)) && (
                        <a 
                          href={`https://wa.me/${(apartment.whatsapp_number || owner.whatsapp_number).replace(/\D/g, '')}?text=Salaan, waxaan xiiseynayaa ${getFloorLabel(floor.floor_number, apartmentFloors.length)} ee gurigaaga: ${apartment.title}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-medium"
                        >
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                          </svg>
                          📱 WhatsApp
                        </a>
                      )}
                      
                      {/* Message Button - Only for logged in users */}
                      {user && (
                        <button 
                          onClick={handleNavigateToMessages}
                          className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium"
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Fariin Dir
                        </button>
                      )}
                      
                      {/* Status message for unavailable floors */}
                      {floor.floor_status !== 'available' && (
                        <div className="text-center py-2 bg-gray-700 rounded-xl">
                          <p className="text-gray-400 text-sm font-medium">
                            {floor.floor_status === 'occupied' && '🏠 Dabaqan hadda waa la kireeyay'}
                            {floor.floor_status === 'not_available' && '❌ Dabaqan hadda lama heli karo'}
                            {floor.floor_status === 'maintenance' && '🔧 Dabaqan waa dayactir'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Property Description */}
        {apartment.description && (
          <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700 mt-8">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Faahfaahin Guriga
            </h3>
            <p className="text-gray-300 leading-relaxed text-lg">{apartment.description}</p>
          </div>
        )}

        {/* Reviews Section */}
        <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700 mt-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white flex items-center">
              <svg className="w-6 h-6 mr-2 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Faallooyinka
            </h3>
            {user && (
              <Link 
                to={`/review/${apartment.id}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                Qor Faallo
              </Link>
            )}
          </div>
          
          {reviews.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📝</div>
              <p className="text-gray-400 text-lg mb-2">Weli faallo malaha</p>
              <p className="text-gray-500">Noqo qofka ugu horreeya ee faallo qora!</p>
            </div>
          ) : (
            <div>
              <div className="text-center mb-6 p-4 bg-gray-700 rounded-xl">
                <div className="text-4xl font-bold text-yellow-400 mb-2">
                  {getAverageRating()}
                </div>
                <div className="flex justify-center mb-2">
                  {renderStars(getAverageRating())}
                </div>
                <div className="text-gray-300">
                  {reviews.length} {reviews.length === 1 ? 'faallo' : 'faallo'}
                </div>
              </div>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {reviews.map((review) => (
                  <div key={review.id} className="bg-gray-700 rounded-xl p-4 border border-gray-600">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-white">
                        {review.profiles?.full_name || 'Qof aan la aqoon'}
                      </p>
                      <div className="flex">
                        {renderStars(review.rating)}
                      </div>
                    </div>
                    <p className="text-gray-300 mb-2">{review.comment}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                    
                    {review.review_replies && review.review_replies.length > 0 && (
                      <div className="mt-3 pl-4 border-l-2 border-blue-500">
                        {review.review_replies.map(reply => (
                          <div key={reply.id} className="mb-2">
                            <div className="flex items-center mb-1">
                              <span className="font-bold text-blue-400">Jawaabta Mulkiilaha</span>
                              <span className="ml-2 text-xs text-gray-500">
                                {new Date(reply.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-gray-300">{reply.reply_text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full screen image viewer modal */}
      <AnimatePresence>
        {showImageViewer && apartment.apartment_images && apartment.apartment_images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ImageViewerModal 
              images={apartment.apartment_images}
              activeIndex={activeImageIndex}
              onClose={() => setShowImageViewer(false)}
              onPrev={() => {
                setActiveImageIndex(prev => 
                  prev === 0 ? apartment.apartment_images.length - 1 : prev - 1
                );
              }}
              onNext={() => {
                setActiveImageIndex(prev => 
                  prev === apartment.apartment_images.length - 1 ? 0 : prev + 1
                );
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 