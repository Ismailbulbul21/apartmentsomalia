import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../ui/LoadingSpinner';

const AllListings = () => {
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const pageSize = 10;

  const fetchApartments = async (pageIndex = 0, status = filterStatus) => {
    try {
      if (pageIndex === 0) {
        setLoading(true);
      }
      
      // Calculate range for pagination
      const from = pageIndex * pageSize;
      const to = from + pageSize - 1;
      
      // First fetch apartments with their images
      let query = supabase
        .from('apartments')
        .select(`
          *,
          apartment_images(id, storage_path, is_primary)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      
      // Apply filter if not 'all'
      if (status !== 'all') {
        query = query.eq('status', status);
      }
      
      const { data: apartmentsData, error: apartmentsError, count } = await query;
      
      if (apartmentsError) throw apartmentsError;
      
      // If we have apartments, fetch their owner profiles
      if (apartmentsData && apartmentsData.length > 0) {
        // Get all owner IDs
        const ownerIds = apartmentsData.map(apt => apt.owner_id);
        
        // Fetch profiles for these owner IDs
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ownerIds);
          
        if (profilesError) throw profilesError;
        
        // Create a map of owner_id -> profile for easier lookup
        const ownerProfiles = {};
        if (profilesData) {
          profilesData.forEach(profile => {
            ownerProfiles[profile.id] = profile;
          });
        }
        
        // Combine apartments with their owner profiles
        const processedData = apartmentsData.map(apt => {
          return {
            ...apt,
            owner_profile: ownerProfiles[apt.owner_id] || null
          };
        });
        
        if (pageIndex === 0) {
          setApartments(processedData);
        } else {
          setApartments(prevData => [...prevData, ...processedData]);
        }
      } else {
        if (pageIndex === 0) {
          setApartments([]);
        }
      }
      
      setHasMore(count > (pageIndex + 1) * pageSize);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error fetching apartments:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    // Reset pagination and fetch data with new filter
    setPage(0);
    fetchApartments(0, filterStatus);
  }, [filterStatus]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchApartments(nextPage);
    }
  };

  const handleChangeStatus = async (apartmentId, newStatus) => {
    try {
      const { error } = await supabase
        .from('apartments')
        .update({ status: newStatus })
        .eq('id', apartmentId);
        
      if (error) throw error;
      
      // Update the local state
      setApartments(apartments.map(apt => {
        if (apt.id === apartmentId) {
          return { ...apt, status: newStatus };
        }
        return apt;
      }));
      
      alert(`Apartment status updated to ${newStatus} successfully`);
    } catch (error) {
      console.error('Error updating apartment status:', error);
      alert('Failed to update apartment status. Please try again.');
    }
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
      
      // Step 6: Delete saved apartments references
      await supabase
        .from('saved_apartments')
        .delete()
        .eq('apartment_id', apartmentId);
      
      // Step 7: Delete apartment images related to the apartment
      await supabase
        .from('apartment_images')
        .delete()
        .eq('apartment_id', apartmentId);
      
      // Step 8: Delete the apartment itself
      const { error } = await supabase
        .from('apartments')
        .delete()
        .eq('id', apartmentId);
        
      if (error) throw error;
      
      // Update the local state
      setApartments(apartments.filter(apt => apt.id !== apartmentId));
      
      alert('Apartment and all related data deleted successfully');
    } catch (error) {
      console.error('Error deleting apartment:', error);
      alert(`Failed to delete apartment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !isInitialized) {
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">All Listings ({apartments.length})</h3>
        
        <div className="flex gap-2">
          <select
            className="border rounded py-1 px-3 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
      
      {apartments.length === 0 ? (
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <p className="text-gray-600">No apartments found with the selected filter</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Apartment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Added
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {apartments.map((apartment) => {
                // Get the primary image, or the first image, or a placeholder
                const primaryImage = apartment.apartment_images?.find(img => img.is_primary);
                const firstImage = apartment.apartment_images?.[0];
                const imageUrl = primaryImage?.storage_path || firstImage?.storage_path || '/placeholder-apartment.jpg';
                
                return (
                  <tr key={apartment.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img 
                            className="h-10 w-10 object-cover rounded"
                            src={imageUrl}
                            alt={apartment.title}
                            loading="lazy"
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {apartment.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            {apartment.location_description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {apartment.owner_profile?.full_name || 'Unknown Owner'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ${apartment.price_per_month}/month
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${apartment.status === 'approved' ? 'bg-green-100 text-green-800' : 
                          apartment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'}`}>
                        {apartment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(apartment.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex gap-2 justify-end">
                        {apartment.status !== 'approved' && (
                          <button
                            onClick={() => handleChangeStatus(apartment.id, 'approved')}
                            className="text-green-600 hover:text-green-900"
                          >
                            Approve
                          </button>
                        )}
                        {apartment.status !== 'pending' && (
                          <button
                            onClick={() => handleChangeStatus(apartment.id, 'pending')}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            Pending
                          </button>
                        )}
                        {apartment.status !== 'rejected' && (
                          <button
                            onClick={() => handleChangeStatus(apartment.id, 'rejected')}
                            className="text-red-600 hover:text-red-900"
                          >
                            Reject
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteApartment(apartment.id)}
                          className="text-night-600 hover:text-night-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Load more button */}
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
              >
                {loading ? 'Loading...' : 'Load More Listings'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AllListings; 