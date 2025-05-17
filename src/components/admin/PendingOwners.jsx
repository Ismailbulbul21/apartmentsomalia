import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../ui/LoadingSpinner';

const PendingOwners = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPendingOwnerRequests();
  }, []);

  const fetchPendingOwnerRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch pending owner requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('owner_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (requestsError) throw requestsError;
      
      if (requestsData && requestsData.length > 0) {
        // Get user IDs from requests
        const userIds = requestsData.map(request => request.user_id);
        
        // Fetch profiles for those user IDs
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
          
        if (profilesError) {
          console.warn('Error fetching profiles:', profilesError);
          // Continue with limited data
        }
        
        // Create a map for easier lookup
        const profileMap = {};
        if (profilesData) {
          profilesData.forEach(profile => {
            profileMap[profile.id] = profile;
          });
        }
        
        // Get emails using our RPC function
        const { data: emailsData, error: emailsError } = await supabase
          .rpc('get_user_emails', { user_ids: userIds });
          
        // Create email lookup map
        const emailMap = {};
        if (!emailsError && emailsData) {
          emailsData.forEach(item => {
            emailMap[item.id] = item.email;
          });
        } else {
          console.warn('Error fetching emails:', emailsError);
        }
        
        // Combine data
        const transformedData = requestsData.map(request => {
          const profile = profileMap[request.user_id] || {};
          return {
            ...request,
            profile: {
              id: request.user_id,
              full_name: profile.full_name || 'Unknown User',
              email: emailMap[request.user_id] || 'No email available'
            }
          };
        });
        
        setPendingRequests(transformedData);
      } else {
        setPendingRequests([]);
      }
    } catch (error) {
      console.error('Error fetching pending owner requests:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPendingOwnerRequests();
  };

  const handleApproveRequest = async (requestId) => {
    try {
      console.log('Approving owner request:', requestId);
      
      const { data, error } = await supabase.rpc('approve_pending_owner', {
        request_id: requestId
      });
      
      if (error) {
        console.error('Error approving owner request:', error);
        throw error;
      }
      
      console.log('Approval result:', data);
      
      // Remove the approved request from state
      setPendingRequests(pendingRequests.filter(request => request.id !== requestId));
      
      alert('Owner request has been approved successfully');
    } catch (error) {
      console.error('Error approving owner request:', error);
      alert(`Failed to approve owner request: ${error.message}`);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const rejectionReason = prompt('Enter reason for rejection (optional):');
      
      // Update the request status
      const { error } = await supabase
        .from('owner_requests')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason || 'Request denied by admin',
          updated_at: new Date()
        })
        .eq('id', requestId);
        
      if (error) throw error;
      
      // Remove the rejected request from state
      setPendingRequests(pendingRequests.filter(request => request.id !== requestId));
      
      alert('Owner request has been rejected');
    } catch (error) {
      console.error('Error rejecting owner request:', error);
      alert(`Failed to reject owner request: ${error.message}`);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Pending Owner Requests ({pendingRequests.length})</h3>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="flex items-center px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
        >
          {refreshing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-700" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>
      
      {loading && !refreshing ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
          <p className="font-medium">Error loading requests</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-2 px-3 py-1 bg-red-200 hover:bg-red-300 text-red-800 text-sm rounded-md transition-colors"
          >
            Try again
          </button>
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <p className="text-gray-600 mb-2">No pending owner requests to approve</p>
          <p className="text-sm text-gray-500">Owner applications will appear here for your review</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingRequests.map((request) => (
            <div key={request.id} className="border rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gray-50 p-4 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-lg">{request.profile.full_name || 'Unknown User'}</h4>
                    <p className="text-sm text-gray-600">{request.profile.email}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    Requested: {new Date(request.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700">Business Details</h5>
                    <p className="text-sm"><span className="font-medium">Name:</span> {request.business_name}</p>
                    <p className="text-sm"><span className="font-medium">Phone:</span> {request.business_phone}</p>
                    {request.whatsapp_number && (
                      <p className="text-sm"><span className="font-medium">WhatsApp:</span> {request.whatsapp_number}</p>
                    )}
                    <p className="text-sm"><span className="font-medium">Address:</span> {request.business_address}</p>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-gray-700">Business Description</h5>
                    <p className="text-sm text-gray-600">{request.business_description}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleApproveRequest(request.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded transition-colors"
                  >
                    Approve as Owner
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingOwners; 