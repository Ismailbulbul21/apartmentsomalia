import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../ui/LoadingSpinner';
import { getImageUrl } from '../../utils/imageUtils';

const PendingApprovals = () => {
  const [pendingListings, setPendingListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState(null);

  useEffect(() => {
    const fetchPendingListings = async () => {
      try {
        setLoading(true);
        
        // Fetch pending apartment listings with a limit to improve initial loading
        const { data, error } = await supabase
          .from('apartments')
          .select(`
            *,
            apartment_images(id, storage_path, is_primary)
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(12); // Limiting to improve initial load time
        
        if (error) throw error;
        
        setPendingListings(data || []);
        setIsInitialized(true);
      } catch (error) {
        console.error('Error fetching pending listings:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPendingListings();
  }, []);

  const handleApproveApartment = async (apartmentId) => {
    try {
      const { error } = await supabase
        .from('apartments')
        .update({ status: 'approved' })
        .eq('id', apartmentId);
        
      if (error) throw error;
      
      // Update the local state
      setPendingListings(pendingListings.filter(apt => apt.id !== apartmentId));
      setSelectedApartment(null);
      
      alert('Apartment listing approved successfully');
    } catch (error) {
      console.error('Error approving apartment:', error);
      alert('Failed to approve apartment. Please try again.');
    }
  };

  const handleRejectApartment = async (apartmentId, rejectionReason) => {
    try {
      const { error } = await supabase
        .from('apartments')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason || 'Does not meet requirements'
        })
        .eq('id', apartmentId);
        
      if (error) throw error;
      
      // Update the local state
      setPendingListings(pendingListings.filter(apt => apt.id !== apartmentId));
      setSelectedApartment(null);
      
      alert('Apartment listing rejected');
    } catch (error) {
      console.error('Error rejecting apartment:', error);
      alert('Failed to reject apartment. Please try again.');
    }
  };

  const handleViewDetails = (apartment) => {
    setSelectedApartment(apartment);
  };

  const handleCloseDetails = () => {
    setSelectedApartment(null);
  };

  const handleDeleteApartment = async (apartmentId) => {
    // Show confirmation dialog
    if (!confirm('Are you sure you want to delete this apartment? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Step 1: Delete messages related to the apartment
      await supabase
        .from('messages')
        .delete()
        .eq('apartment_id', apartmentId);
      
      // Step 2: Delete conversations related to the apartment
      await supabase
        .from('conversations')
        .delete()
        .eq('apartment_id', apartmentId);
      
      // Step 3: Get review IDs related to this apartment
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id')
        .eq('apartment_id', apartmentId);
      
      // Step 4: If there are reviews, delete their replies first
      if (reviewsData && reviewsData.length > 0) {
        const reviewIds = reviewsData.map(review => review.id);
        
        await supabase
          .from('review_replies')
          .delete()
          .in('review_id', reviewIds);
        
        // Step 5: Delete the reviews
        await supabase
          .from('reviews')
          .delete()
          .eq('apartment_id', apartmentId);
      }
      
      // Step 6: Delete apartment images related to the apartment
      await supabase
        .from('apartment_images')
        .delete()
        .eq('apartment_id', apartmentId);
      
      // Step 7: Delete the apartment itself
      const { error } = await supabase
        .from('apartments')
        .delete()
        .eq('id', apartmentId);
        
      if (error) throw error;
      
      // Update the local state
      setPendingListings(pendingListings.filter(apt => apt.id !== apartmentId));
      setSelectedApartment(null);
      
      alert('Apartment and all related data deleted successfully');
    } catch (error) {
      console.error('Error deleting apartment:', error);
      alert(`Failed to delete apartment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !isInitialized) {
    return <LoadingSpinner size="lg" />;
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded-md">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-semibold mb-4">Pending Apartments ({pendingListings.length})</h3>
      
      {pendingListings.length === 0 ? (
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <p className="text-gray-600">No pending apartment listings to approve</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingListings.map((apartment) => {
            // Get the primary image, or the first image, or a placeholder
            const primaryImage = apartment.apartment_images?.find(img => img.is_primary);
            const firstImage = apartment.apartment_images?.[0];
            let imageUrl;
            
            if (apartment.primary_image_path) {
              imageUrl = getImageUrl(apartment.primary_image_path);
            } else if (primaryImage?.storage_path) {
              imageUrl = getImageUrl(primaryImage.storage_path);
            } else if (firstImage?.storage_path) {
              imageUrl = getImageUrl(firstImage.storage_path);
            } else {
              imageUrl = '/images/placeholder-apartment.svg';
            }
            
            return (
              <div key={apartment.id} className="border rounded-lg overflow-hidden shadow-sm">
                <div className="aspect-video relative overflow-hidden cursor-pointer" onClick={() => handleViewDetails(apartment)}>
                  <img 
                    src={imageUrl}
                    alt={apartment.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      console.error("Image failed to load:", e.target.src);
                      e.target.src = '/images/placeholder-apartment.svg';
                    }}
                  />
                </div>
                <div className="p-4">
                  <h4 className="font-medium text-lg">{apartment.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    {apartment.location_description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      ${apartment.price_per_month}/month
                    </span>
                    <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                      {apartment.rooms} rooms
                    </span>
                    <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                      {apartment.bathrooms} baths
                    </span>
                  </div>
                  <div className="mb-3">
                    <button
                      onClick={() => handleViewDetails(apartment)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded transition-colors mb-2"
                    >
                      View Details
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveApartment(apartment.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Enter reason for rejection (optional):');
                        handleRejectApartment(apartment.id, reason);
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                  <div className="mt-2">
                    <button
                      onClick={() => handleDeleteApartment(apartment.id)}
                      className="w-full bg-gray-800 hover:bg-gray-900 text-white text-sm py-2 px-3 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {loading && isInitialized && (
        <div className="mt-6 text-center">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {/* Apartment Detail Modal */}
      {selectedApartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">{selectedApartment.title}</h3>
                <button onClick={handleCloseDetails} className="text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Image gallery */}
              <div className="mb-6">
                {selectedApartment.apartment_images && selectedApartment.apartment_images.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedApartment.apartment_images.map((image, index) => (
                      <div key={image.id || index} className="aspect-video rounded-lg overflow-hidden">
                        <img
                          src={getImageUrl(image.storage_path)}
                          alt={`${selectedApartment.title} - Image ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error("Image failed to load:", e.target.src);
                            e.target.src = '/images/placeholder-apartment.svg';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-100 flex items-center justify-center rounded-lg">
                    <p className="text-gray-500">No images available</p>
                  </div>
                )}
              </div>
              
              {/* Apartment details */}
              <div className="mb-6">
                <h4 className="font-medium text-lg mb-2">Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Location</p>
                    <p className="font-medium">{selectedApartment.location_description}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Price</p>
                    <p className="font-medium">${selectedApartment.price_per_month}/month</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Rooms</p>
                    <p className="font-medium">{selectedApartment.rooms}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Bathrooms</p>
                    <p className="font-medium">{selectedApartment.bathrooms}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Furnished</p>
                    <p className="font-medium">{selectedApartment.is_furnished ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Created</p>
                    <p className="font-medium">{new Date(selectedApartment.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              
              {/* Description */}
              <div className="mb-6">
                <h4 className="font-medium text-lg mb-2">Description</h4>
                <p className="text-gray-700">{selectedApartment.description}</p>
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => handleApproveApartment(selectedApartment.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors"
                >
                  Approve Listing
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Enter reason for rejection (optional):');
                    handleRejectApartment(selectedApartment.id, reason);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition-colors"
                >
                  Reject Listing
                </button>
                <button
                  onClick={() => handleDeleteApartment(selectedApartment.id)}
                  className="flex-1 bg-gray-800 hover:bg-gray-900 text-white py-2 px-4 rounded transition-colors"
                >
                  Delete Listing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingApprovals; 