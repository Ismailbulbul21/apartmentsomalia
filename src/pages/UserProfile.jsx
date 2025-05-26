import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, getProfileImageUrl } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function UserProfile() {
  const { 
    user, 
    userRole, 
    logout, 
    ownerStatus, 
    refreshOwnerStatus, 
    refreshUserProfile,
    roleChangeNotification,
    clearRoleChangeNotification
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [savedApartments, setSavedApartments] = useState([]);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  // Admin state
  const [adminUsers, setAdminUsers] = useState([]);
  const [pendingOwners, setPendingOwners] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Handle location state for tab selection
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  // Fetch user data
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Debug log to check user role
    console.log('User role from auth context:', userRole);
    
    // Check owner status
    refreshOwnerStatus();
    
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileError) throw profileError;
        
        setUserProfile(profileData);
        setFullName(profileData.full_name || '');
        setEmail(profileData.email || user.email || '');
        setWhatsappNumber(profileData.whatsapp_number || '');
        setAvatarUrl(profileData.avatar_url || '');
        
        // Fetch saved apartments
        const { data: savedData, error: savedError } = await supabase
          .from('saved_apartments')
          .select(`
            id,
            apartment_id,
            created_at,
            apartments:apartment_id(
              id, 
              title, 
              price_per_month, 
              location_description,
              rooms,
              bathrooms,
              is_available,
              apartment_images(id, storage_path, is_primary)
            )
          `)
          .eq('user_id', user.id);
        
        if (savedError) throw savedError;
        
        // Filter out any null references (in case an apartment was deleted)
        const validSavedApts = savedData.filter(item => item.apartments !== null);
        setSavedApartments(validSavedApts || []);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [user]);

  // Admin data fetch function
  const fetchAdminData = async () => {
    if (userRole !== 'admin') return;
    
    try {
      setAdminLoading(true);
      
      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (usersError) throw usersError;
      setAdminUsers(usersData || []);
      
      // Fetch pending owner requests with profile data using proper join syntax
      const { data: ownersData, error: ownersError } = await supabase
        .from('owner_requests')
        .select(`
          id,
          user_id,
          business_name,
          business_phone,
          business_address,
          business_description,
          status,
          rejection_reason,
          created_at,
          updated_at,
          profiles:user_id (id, full_name, avatar_url)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (ownersError) throw ownersError;
      setPendingOwners(ownersData || []);
      
      // Fetch apartments using the new RPC function
      try {
        const { data: apartmentsData, error: rpcError } = await supabase
          .rpc('get_apartments_with_profiles');
          
        if (rpcError) {
          console.error('Failed to fetch apartments with RPC:', rpcError);
          
          // Fallback: try fetching apartments only without profile info
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('apartments')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (fallbackError) throw fallbackError;
          setApartments(fallbackData || []);
        } else {
          setApartments(apartmentsData || []);
        }
      } catch (error) {
        console.error('Error fetching apartments:', error);
        setError('Failed to load apartments data.');
      }
      
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setError(error.message);
    } finally {
      setAdminLoading(false);
    }
  };
  
  // Load admin data when tab is selected
  useEffect(() => {
    if (activeTab === 'admin' && userRole === 'admin') {
      fetchAdminData();
    }
  }, [activeTab, userRole]);

  // Handle profile update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    try {
      setUpdating(true);
      setUpdateError(null);
      
      let updatedAvatarUrl = avatarUrl;
      
      // If a new avatar file was selected, upload it
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('user_avatars')
          .upload(filePath, avatarFile);
        
        if (uploadError) throw uploadError;
        
        updatedAvatarUrl = supabase.storage.from('user_avatars').getPublicUrl(filePath).data.publicUrl;
      }
      
      // First try to update profile using RPC to bypass RLS
      const { data: rpcResult, error: rpcError } = await supabase.rpc('update_profile', {
        p_full_name: fullName,
        p_whatsapp_number: whatsappNumber,
        p_avatar_url: updatedAvatarUrl
      });
      
      // If RPC fails, try direct update
      if (rpcError) {
        console.warn('RPC update failed, trying direct update:', rpcError);
        
        // Try direct update
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            whatsapp_number: whatsappNumber,
            avatar_url: updatedAvatarUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
          
        if (updateError) throw updateError;
      } else if (rpcResult && !rpcResult.success) {
        throw new Error(rpcResult.message || 'Failed to update profile');
      }
      
      // After successful update, refresh the profile in the context
      await refreshUserProfile();
      
      // Update local state as well
      setAvatarUrl(updatedAvatarUrl);
      setAvatarFile(null);
      
      // Show success message
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setUpdateError(error.message);
    } finally {
      setUpdating(false);
    }
  };

  // Handle avatar file selection
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle removing a saved apartment
  const handleRemoveSaved = async (savedId) => {
    try {
      const { error } = await supabase
        .from('saved_apartments')
        .delete()
        .eq('id', savedId);
      
      if (error) throw error;
      
      // Update local state
      setSavedApartments(savedApartments.filter(apt => apt.id !== savedId));
    } catch (error) {
      console.error('Error removing saved apartment:', error);
      alert('Failed to remove apartment from saved list. Please try again.');
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      const { success } = await logout();
      if (success) {
        navigate('/login');
      } else {
        alert('Failed to sign out. Please try again.');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  // Owner application status component
  const OwnerApplicationStatus = () => {
    if (!ownerStatus) return null;
    
    // Not applied yet
    if (!ownerStatus.requestStatus) {
      return (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
          <h3 className="font-medium text-lg mb-2">Become a Property Owner</h3>
          <p className="text-gray-600 mb-4">
            List your properties and connect with potential renters in Mogadishu.
          </p>
          <Link
            to="/become-owner"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Apply Now
          </Link>
        </div>
      );
    }
    
    // Pending application
    if (ownerStatus.hasPendingRequest) {
      return (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
          <h3 className="font-medium text-lg text-blue-700 mb-2">Owner Application Pending</h3>
          <p className="text-blue-600 mb-1">
            Your request to become a property owner is currently under review.
          </p>
          <p className="text-sm text-blue-500">
            We'll notify you once your application has been processed.
          </p>
        </div>
      );
    }
    
    // Rejected application
    if (ownerStatus.requestStatus === 'rejected') {
      return (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6">
          <h3 className="font-medium text-lg text-red-700 mb-2">Owner Application Rejected</h3>
          {ownerStatus.rejectionReason && (
            <p className="text-red-600 mb-3">
              Reason: {ownerStatus.rejectionReason}
            </p>
          )}
          <Link
            to="/become-owner"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Apply Again
          </Link>
        </div>
      );
    }
    
    // Approved application
    if (ownerStatus.requestStatus === 'approved' || ownerStatus.isOwner) {
      return (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6">
          <h3 className="font-medium text-lg text-green-700 mb-2">You're a Property Owner!</h3>
          <p className="text-green-600 mb-4">
            You can now list your properties and manage your listings.
          </p>
          <Link
            to="/owner/dashboard"
            className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
          >
            Go to Owner Dashboard
          </Link>
        </div>
      );
    }
    
    return null;
  };

  // Handle approve owner request
  const handleApproveOwner = async (requestId) => {
    try {
      // First update the request
      const { error: updateError } = await supabase
        .from('owner_requests')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);
      
      if (updateError) throw updateError;
      
      // Get the user ID from the request
      const { data: requestData } = await supabase
        .from('owner_requests')
        .select('user_id')
        .eq('id', requestId)
        .single();
      
      if (!requestData) throw new Error('Request not found');
      
      // Update the user's role to 'owner'
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ 
          role: 'owner',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestData.user_id);
      
      if (roleError) throw roleError;
      
      // Refresh the data
      fetchAdminData();
      
    } catch (error) {
      console.error('Error approving owner:', error);
      alert('Failed to approve owner request. Please try again.');
    }
  };
  
  // Handle reject owner request
  const handleRejectOwner = async (requestId, reason) => {
    const rejectionReason = prompt('Enter reason for rejection (optional):');
    
    try {
      const { error } = await supabase
        .from('owner_requests')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);
      
      if (error) throw error;
      
      // Refresh the data
      fetchAdminData();
      
    } catch (error) {
      console.error('Error rejecting owner:', error);
      alert('Failed to reject owner request. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 relative"
      style={{
        background: `linear-gradient(rgba(8, 12, 20, 0.88), rgba(5, 7, 12, 0.94)), 
                    url('/dark-apartment-bg2.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        boxShadow: 'inset 0 0 120px rgba(0, 0, 0, 0.8)'
      }}
    >
      <div className="max-w-6xl mx-auto">
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
            <p>{error}</p>
          </div>
        )}
        
        <div className="bg-white/85 backdrop-blur-md shadow-2xl rounded-xl overflow-hidden border border-gray-800/10">
          <div className="flex flex-col md:flex-row">
            {/* Sidebar with user info and navigation - Now stacks on mobile */}
            <div className="w-full md:w-1/4 bg-gradient-to-b from-slate-900 to-slate-800 p-6 text-white">
              {/* Mobile-friendly user info section */}
              <div className="text-center mb-6">
                <div className="inline-block relative">
                  <img 
                    src={avatarUrl || '/images/default-avatar.svg'} 
                    alt={fullName || 'User'} 
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white/20 object-cover mx-auto mb-4 shadow-xl"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/images/default-avatar.svg';
                    }}
                  />
                  {userRole === 'owner' && (
                    <span className="absolute top-0 right-0 bg-yellow-500 text-xs text-black font-bold rounded-full p-1">
                      OWNER
                    </span>
                  )}
                  {userRole === 'admin' && (
                    <span className="absolute top-0 right-0 bg-red-500 text-xs text-white font-bold rounded-full p-1">
                      ADMIN
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-semibold">{fullName || 'User'}</h2>
                <p className="text-slate-300 text-sm truncate max-w-full">{email}</p>
                {/* Role display */}
                <p className="text-blue-300 text-xs mt-1">Role: {userRole || 'none'}</p>
                
                {/* Role change notification */}
                <AnimatePresence>
                  {roleChangeNotification && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-3 p-2 bg-blue-600 text-white rounded-md shadow-lg"
                    >
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium">
                          Your role has been changed from{' '}
                          <span className="font-bold">{roleChangeNotification.previousRole}</span> to{' '}
                          <span className="font-bold">{roleChangeNotification.newRole}</span>
                        </p>
                        <button 
                          onClick={clearRoleChangeNotification}
                          className="ml-2 text-white hover:text-blue-200"
                        >
                          ✕
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Mobile horizontal scrollable nav - Add admin tab conditionally */}
              <div className="md:hidden flex overflow-x-auto pb-2 mb-2 space-x-2 scrollbar-hide">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex-shrink-0 px-4 py-2 rounded-md ${
                    activeTab === 'profile' ? 'bg-slate-700 shadow-inner' : 'bg-slate-800/50'
                  }`}
                >
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab('saved')}
                  className={`flex-shrink-0 px-4 py-2 rounded-md ${
                    activeTab === 'saved' ? 'bg-slate-700 shadow-inner' : 'bg-slate-800/50'
                  }`}
                >
                  Saved
                </button>
                <button
                  onClick={() => setActiveTab('messages')}
                  className={`flex-shrink-0 px-4 py-2 rounded-md ${
                    activeTab === 'messages' ? 'bg-slate-700 shadow-inner' : 'bg-slate-800/50'
                  }`}
                >
                  Messages
                </button>
                {userRole === 'admin' && (
                  <button
                    onClick={() => setActiveTab('admin')}
                    className={`flex-shrink-0 px-4 py-2 rounded-md ${
                      activeTab === 'admin' ? 'bg-red-600 shadow-inner' : 'bg-red-700/70'
                    }`}
                  >
                    Admin
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex-shrink-0 px-4 py-2 rounded-md text-red-200 bg-slate-800/50"
                >
                  Sign Out
                </button>
              </div>
              
              {/* Desktop navigation - Add admin tab conditionally */}
              <nav className="hidden md:block space-y-1">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`block w-full px-4 py-2 rounded-md text-left ${
                    activeTab === 'profile' ? 'bg-slate-700 shadow-inner' : 'hover:bg-slate-700/50'
                  }`}
                >
                  Profile Information
                </button>
                <button
                  onClick={() => setActiveTab('saved')}
                  className={`block w-full px-4 py-2 rounded-md text-left ${
                    activeTab === 'saved' ? 'bg-slate-700 shadow-inner' : 'hover:bg-slate-700/50'
                  }`}
                >
                  Saved Apartments
                </button>
                <button
                  onClick={() => setActiveTab('messages')}
                  className={`block w-full px-4 py-2 rounded-md text-left ${
                    activeTab === 'messages' ? 'bg-slate-700 shadow-inner' : 'hover:bg-slate-700/50'
                  }`}
                >
                  Messages
                </button>
                {userRole === 'admin' && (
                  <button
                    onClick={() => setActiveTab('admin')}
                    className={`block w-full px-4 py-2 rounded-md text-left ${
                      activeTab === 'admin' ? 'bg-red-600 text-white shadow-inner' : 'bg-red-700/70 text-white hover:bg-red-600/80'
                    }`}
                  >
                    Admin Dashboard
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="block w-full px-4 py-2 rounded-md text-left text-red-200 hover:bg-slate-700/50 mt-4"
                >
                  Sign Out
                </button>
              </nav>
              
              {/* Show owner status section if applicable */}
              {ownerStatus && ownerStatus.requestStatus !== 'approved' && (
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <OwnerApplicationStatus />
                </div>
              )}
            </div>
            
            {/* Main content area */}
            <div className="w-full md:w-3/4 p-4 md:p-6">
              <AnimatePresence mode="wait">
                {activeTab === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">Profile Information</h3>
                    
                    {/* Profile form */}
                    <form onSubmit={handleUpdateProfile}>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                            Full Name
                          </label>
                          <input
                            type="text"
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Email
                          </label>
                          <input
                            type="email"
                            id="email"
                            value={email}
                            readOnly
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50"
                          />
                          <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
                        </div>
                        
                        <div>
                          <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700">
                            WhatsApp Number
                          </label>
                          <input
                            type="text"
                            id="whatsapp"
                            value={whatsappNumber}
                            onChange={(e) => setWhatsappNumber(e.target.value)}
                            placeholder="+1234567890"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Profile Photo
                          </label>
                          <div className="mt-2 flex items-center">
                            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 mr-4 shadow-md">
                              <img
                                src={avatarUrl || '/images/default-avatar.svg'}
                                alt="Profile"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = '/images/default-avatar.svg';
                                }}
                              />
                            </div>
                            <label className="cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none">
                              <span>Change</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                                className="sr-only"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <button
                          type="submit"
                          disabled={updating}
                          className={`w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-white text-base bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                            updating ? 'opacity-75 cursor-not-allowed' : ''
                          }`}
                        >
                          {updating ? 'Updating...' : 'Update Profile'}
                        </button>
                      </div>
                      
                      {updateSuccess && (
                        <div className="mt-4 bg-green-50 border-l-4 border-green-400 p-4 text-green-700">
                          Profile updated successfully!
                        </div>
                      )}
                      
                      {updateError && (
                        <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4 text-red-700">
                          {updateError}
                        </div>
                      )}
                    </form>
                  </motion.div>
                )}
                
                {activeTab === 'saved' && (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">Saved Apartments</h3>
                    
                    {/* Saved apartments list */}
                    {savedApartments.length === 0 ? (
                      <div className="bg-gray-50 rounded-lg p-6 text-center">
                        <p className="text-gray-500">You haven't saved any apartments yet.</p>
                        <Link
                          to="/"
                          className="mt-4 inline-block text-primary-600 hover:text-primary-700"
                        >
                          Browse Apartments
                        </Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                        {savedApartments.map((item, index) => (
                          <motion.div 
                            key={item.id} 
                            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.1 }}
                            whileHover={{ y: -5 }}
                          >
                            <div className="flex flex-col h-full">
                              <div className="w-full h-40 md:h-48 overflow-hidden relative">
                                <img
                                  src={
                                    item.apartments.apartment_images?.length
                                      ? supabase.storage
                                          .from('apartment_images')
                                          .getPublicUrl(item.apartments.apartment_images[0].storage_path).data.publicUrl
                                      : '/placeholder-apartment.jpg'
                                  }
                                  alt={item.apartments.title}
                                  className="w-full h-full object-cover transition-transform hover:scale-110 duration-300"
                                  onError={(e) => { e.target.src = '/placeholder-apartment.jpg'; }}
                                />
                                <div className="absolute top-2 right-2">
                                  <motion.button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleRemoveSaved(item.id);
                                    }}
                                    className="p-1.5 bg-white/90 backdrop-blur-sm rounded-full text-red-600 hover:bg-white hover:text-red-700"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </motion.button>
                                </div>
                              </div>
                              
                              <div className="p-4 flex flex-col justify-between flex-grow">
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-1 truncate">
                                    {item.apartments.title}
                                  </h4>
                                  <p className="text-sm text-gray-500 mb-2">{item.apartments.location_description}</p>
                                  <div className="flex items-center text-sm text-gray-700 flex-wrap gap-y-1">
                                    <span className="font-semibold">${item.apartments.price_per_month}</span>
                                    <span className="mx-1">/month</span>
                                    <span className="mx-2">•</span>
                                    <span>{item.apartments.rooms} rooms</span>
                                    <span className="mx-2">•</span>
                                    <span>{item.apartments.bathrooms} baths</span>
                                  </div>
                                </div>
                                
                                <div className="mt-4">
                                  <Link 
                                    to={`/apartments/${item.apartment_id}`} 
                                    className="w-full inline-block text-center py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                                  >
                                    View Details
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
                
                {activeTab === 'messages' && (
                  <motion.div
                    key="messages"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">Messages</h3>
                    <MessagesTab userId={user.id} />
                  </motion.div>
                )}
                
                {/* New Admin tab content */}
                {activeTab === 'admin' && userRole === 'admin' && (
                  <motion.div
                    key="admin"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6 text-red-600">Admin Dashboard</h3>
                    
                    {adminLoading ? (
                      <div className="flex justify-center py-8">
                        <LoadingSpinner />
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {/* Pending Owner Requests Section */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                          <div className="bg-red-50 p-4 border-b border-red-100">
                            <h4 className="text-lg font-medium text-red-800">Pending Owner Requests</h4>
                          </div>
                          
                          {pendingOwners.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                              No pending owner requests
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                    <th className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Info</th>
                                    <th className="hidden md:table-cell px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
                                    <th className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {pendingOwners.map(request => (
                                    <tr key={request.id}>
                                      <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                          <div className="flex-shrink-0 h-8 w-8 md:h-10 md:w-10 rounded-full bg-gray-200 overflow-hidden">
                                            {request.profiles?.avatar_url ? (
                                              <img 
                                                src={getProfileImageUrl(request.profiles.avatar_url)} 
                                                alt={request.profiles.full_name} 
                                                className="h-full w-full object-cover"
                                                onError={(e) => {
                                                  e.target.onerror = null;
                                                  e.target.src = '/images/default-avatar.svg';
                                                }}
                                              />
                                            ) : (
                                              <div className="h-full w-full flex items-center justify-center bg-gray-300 text-gray-600">
                                                {request.profiles?.full_name?.[0] || '?'}
                                              </div>
                                            )}
                                          </div>
                                          <div className="ml-2 md:ml-4">
                                            <div className="text-xs md:text-sm font-medium text-gray-900 truncate max-w-[100px] md:max-w-full">
                                              {request.profiles?.full_name || 'Unknown User'}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">
                                        <div className="text-xs md:text-sm text-gray-500 truncate max-w-[100px] md:max-w-full">{request.business_name || 'No business name'}</div>
                                        <div className="text-xs md:text-sm text-gray-500 truncate max-w-[100px] md:max-w-full">{request.business_phone || 'No phone'}</div>
                                      </td>
                                      <td className="hidden md:table-cell px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">
                                        {new Date(request.created_at).toLocaleDateString()}
                                      </td>
                                      <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium">
                                        <button 
                                          onClick={() => handleApproveOwner(request.id)}
                                          className="text-green-600 hover:text-green-900 mr-2 md:mr-4"
                                        >
                                          Approve
                                        </button>
                                        <button 
                                          onClick={() => handleRejectOwner(request.id)}
                                          className="text-red-600 hover:text-red-900"
                                        >
                                          Reject
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                        
                        {/* Users Management Section */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                          <div className="bg-blue-50 p-4 border-b border-blue-100">
                            <h4 className="text-lg font-medium text-blue-800">User Management</h4>
                          </div>
                          
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                  <th className="hidden md:table-cell px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                  <th className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                  <th className="hidden md:table-cell px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {adminUsers.slice(0, 10).map(profile => (
                                  <tr key={profile.id}>
                                    <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <div className="flex-shrink-0 h-8 w-8 md:h-10 md:w-10 rounded-full bg-gray-200 overflow-hidden">
                                          {profile.avatar_url ? (
                                            <img 
                                              src={getProfileImageUrl(profile.avatar_url)} 
                                              alt={profile.full_name} 
                                              className="h-full w-full object-cover"
                                              onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = '/images/default-avatar.svg';
                                              }}
                                            />
                                          ) : (
                                            <div className="h-full w-full flex items-center justify-center bg-gray-300 text-gray-600">
                                              {profile.full_name?.[0] || '?'}
                                            </div>
                                          )}
                                        </div>
                                        <div className="ml-2 md:ml-4">
                                          <div className="text-xs md:text-sm font-medium text-gray-900 truncate max-w-[100px] md:max-w-full">
                                            {profile.full_name || 'Unnamed User'}
                                          </div>
                                          <div className="md:hidden text-xs text-gray-500 truncate max-w-[100px]">
                                            {profile.email || 'No email'}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="hidden md:table-cell px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">
                                      {profile.email || 'No email'}
                                    </td>
                                    <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${profile.role === 'admin' ? 'bg-red-100 text-red-800' : 
                                          profile.role === 'owner' ? 'bg-yellow-100 text-yellow-800' : 
                                          'bg-green-100 text-green-800'}`}>
                                        {profile.role || 'user'}
                                      </span>
                                    </td>
                                    <td className="hidden md:table-cell px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">
                                      {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            
                            {adminUsers.length > 10 && (
                              <div className="px-3 py-3 md:px-6 bg-gray-50 text-right text-xs md:text-sm">
                                <span className="text-gray-500">Showing 10 of {adminUsers.length} users</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Apartments Management Preview */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                          <div className="bg-green-50 p-4 border-b border-green-100">
                            <h4 className="text-lg font-medium text-green-800">Apartment Listings</h4>
                          </div>
                          
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                                  <th className="hidden md:table-cell px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                                  <th className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                  <th className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {apartments.slice(0, 5).map(apt => (
                                  <tr key={apt.id}>
                                    <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">
                                      <div className="text-xs md:text-sm font-medium text-gray-900 truncate max-w-[100px] md:max-w-full">
                                        {apt.title || 'Unnamed Property'}
                                      </div>
                                      <div className="md:hidden text-xs text-gray-500 truncate max-w-[100px]">
                                        by {apt.owner_full_name || 'Unknown Owner'}
                                      </div>
                                    </td>
                                    <td className="hidden md:table-cell px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">
                                      {apt.owner_full_name || 'Unknown Owner'}
                                    </td>
                                    <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">
                                      ${apt.price_per_month}/month
                                    </td>
                                    <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${apt.is_available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {apt.is_available ? 'Available' : 'Unavailable'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            
                            {apartments.length > 5 && (
                              <div className="px-3 py-3 md:px-6 bg-gray-50 text-right text-xs md:text-sm">
                                <span className="text-gray-500">Showing 5 of {apartments.length} apartments</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Messages component with animations
const MessagesTab = ({ userId }) => {
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messageContainerRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [prevMessagesLength, setPrevMessagesLength] = useState(0);
  const [showConversations, setShowConversations] = useState(true);
  
  // Toggle between conversations list and messages on mobile
  const toggleConversationList = () => {
    setShowConversations(!showConversations);
  };
  
  // On mobile, when conversation is selected, hide the list
  useEffect(() => {
    if (selectedConversation && window.innerWidth < 768) {
      setShowConversations(false);
    }
  }, [selectedConversation]);
  
  // Reset to showing conversations when no conversation is selected
  useEffect(() => {
    if (!selectedConversation) {
      setShowConversations(true);
    }
  }, [selectedConversation]);
  
  // Handle back button on mobile
  const handleBackToConversations = () => {
    setShowConversations(true);
  };

  // Scroll to bottom of messages with enhanced smooth effect
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const container = messageContainerRef.current;
      const scrollElement = messagesEndRef.current;
      
      if (container) {
        // Enhanced smooth scrolling with animation
        container.scrollTo({
          top: scrollElement.offsetTop,
          behavior: 'smooth'
        });
      } else {
        // Fallback to default
        scrollElement.scrollIntoView({ 
          behavior: "smooth",
          block: "end"
        });
      }
    }
  }

  // Initial conversations load
  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);
      await fetchConversations();
      setInitialLoading(false);
    };
    
    loadInitialData();
  }, [userId]);

  // Handle conversation selection from sessionStorage (from notification)
  useEffect(() => {
    // Only run after conversations are loaded
    if (!initialLoading && conversations.length > 0) {
      const notificationConvId = sessionStorage.getItem('selected_conversation_id');
      const fromNotification = sessionStorage.getItem('from_notification');
      
      if (notificationConvId && fromNotification === 'true') {
        const conversation = conversations.find(c => c.id === notificationConvId);
        if (conversation) {
          // First clear loading states to prevent flickering
          setLoading(false);
          setIsRefreshing(false);
          
          // Set the conversation and scroll settings
          setSelectedConversation(conversation);
          setUserHasScrolled(false);
          setPrevMessagesLength(0);
          
          // Clear the sessionStorage to prevent reselecting on refresh
          sessionStorage.removeItem('selected_conversation_id');
          sessionStorage.removeItem('from_notification');
        }
      }
    }
  }, [initialLoading, conversations]);

  // Modified: Only auto-scroll when new messages are added or on initial load
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      // Only auto-scroll if:
      // 1. New messages were added (messages.length > prevMessagesLength)
      // 2. This is initial load (prevMessagesLength === 0)
      // 3. User hasn't manually scrolled up
      if (messages.length > prevMessagesLength || prevMessagesLength === 0 || !userHasScrolled) {
        scrollToBottom();
      }
      
      // Update previous message length for next comparison
      setPrevMessagesLength(messages.length);
    }
  }, [messages, prevMessagesLength, userHasScrolled, loading]);

  // Check if scroll button should appear
  useEffect(() => {
    const checkScrollPosition = () => {
      if (!messageContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      // Show scroll button only if not near bottom and have enough messages
      setShowScrollBtn(!isNearBottom && messages.length > 5);
      
      // Track if user has scrolled up
      if (!isNearBottom && scrollTop > 0) {
        setUserHasScrolled(true);
      } else if (isNearBottom) {
        // Reset when user is at the bottom again
        setUserHasScrolled(false);
      }
    };
    
    const container = messageContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      return () => container.removeEventListener('scroll', checkScrollPosition);
    }
  }, [messages]);

  // Reset userHasScrolled when changing conversations
  useEffect(() => {
    if (selectedConversation) {
      // Clear any existing messages to prevent flashing
      setMessages([]);
      
      // Reset scroll state when changing conversations
      setUserHasScrolled(false);
      setPrevMessagesLength(0);
      setLoading(true);
      
      // Fetch messages for the selected conversation
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id]); // Only trigger on ID change, not full object

  const fetchConversations = async () => {
    if (isRefreshing) return;

    try {
      setLoading(true);
      setIsRefreshing(true);
      
      // Fetch the conversations with apartment data
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select(`
          *,
          apartments(id, title, owner_id)
        `)
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
        .order('updated_at', { ascending: false });
      
      if (conversationsError) throw conversationsError;
      
      if (conversationsData) {
        // Get all participant IDs to fetch profiles
        const participantIds = new Set();
        
        conversationsData.forEach(conv => {
          if (conv.participant_one !== userId) {
            participantIds.add(conv.participant_one);
          }
          if (conv.participant_two !== userId) {
            participantIds.add(conv.participant_two);
          }
        });
        
        // Fetch profiles for all participants
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', Array.from(participantIds));
        
        if (profilesError) throw profilesError;
        
        // Create a map of profiles by ID
        const profilesMap = (profilesData || []).reduce((map, profile) => {
          // Process avatar URL if present
          if (profile.avatar_url) {
            if (profile.avatar_url && profile.avatar_url.trim() !== '') {
              profile.avatar_url = getProfileImageUrl(profile.avatar_url);
            } else {
              // If empty string, set to null so we can handle it properly in the UI
              profile.avatar_url = null;
            }
          }
          map[profile.id] = profile;
          return map;
        }, {});
        
        // Add participant data to each conversation
        const enrichedData = await Promise.all(conversationsData.map(async (conv) => {
          // Determine the other participant
          const otherParticipantId = conv.participant_one === userId 
            ? conv.participant_two 
            : conv.participant_one;
          
          // Get profile for the other participant
          const otherParticipant = profilesMap[otherParticipantId];
          
          // Process avatar URL if available
          let participantAvatar = null;
          if (otherParticipant && otherParticipant.avatar_url) {
            // Use the getProfileImageUrl helper to ensure proper URL format
            if (otherParticipant.avatar_url && otherParticipant.avatar_url.trim() !== '') {
              participantAvatar = getProfileImageUrl(otherParticipant.avatar_url);
            }
          }

          // Make a new participant object with safe avatar URL
          const safeParticipant = otherParticipant ? {
            ...otherParticipant,
            avatar_url: participantAvatar
          } : null;
          
          // Get the last message for preview
          const { data: lastMessageData, error: lastMessageError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          // Count unread messages
          const { count: unreadCount, error: countError } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('recipient_id', userId)
            .eq('is_read', false);
          
          const lastMessage = lastMessageData && lastMessageData.length > 0 
            ? lastMessageData[0] 
            : null;
          
          return {
            ...conv,
            otherParticipant: safeParticipant,
            lastMessage,
            unreadCount: unreadCount || 0,
            hasUnread: (unreadCount || 0) > 0
          };
        }));
        
        setConversations(enrichedData);
      } else {
        setConversations([]);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    if (!conversationId) {
      console.log('No conversation ID provided to fetchMessages');
      setMessages([]);
      setLoading(false);
      return;
    }
    
    try {
      // Fetch the messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (messagesError) throw messagesError;
      
      if (messagesData && messagesData.length > 0) {
        // Fetch profiles for message senders
        const senderIds = [...new Set(messagesData.map(msg => msg.sender_id))];
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', senderIds);
        
        if (profilesError) throw profilesError;
        
        // Create a map of profiles by ID
        const profilesMap = (profilesData || []).reduce((map, profile) => {
          // Process avatar URL if present
          let avatarUrl = null;
          if (profile.avatar_url) {
            if (profile.avatar_url && profile.avatar_url.trim() !== '') {
              avatarUrl = getProfileImageUrl(profile.avatar_url);
            }
          }
          
          map[profile.id] = {
            ...profile,
            avatar_url: avatarUrl
          };
          return map;
        }, {});
        
        // Add profiles to messages
        const enrichedMessages = messagesData.map(msg => ({
          ...msg,
          profiles: profilesMap[msg.sender_id] || { full_name: 'Unknown User', avatar_url: null },
          isUnread: msg.recipient_id === userId && !msg.is_read
        }));
        
        setMessages(enrichedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
      setError(`Failed to load messages: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Set up subscription for message updates
  useEffect(() => {
    if (!selectedConversation) return;
    
    try {
      // Set up realtime subscription for new messages
      const messagesSubscription = supabase
        .channel(`messages-${selectedConversation.id}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}` 
          },
          (payload) => {
            // When a new message comes in, only fetch if it's from the other user
            // (our own messages are already in the UI)
            if (payload.new && payload.new.sender_id !== userId) {
              console.log('Real-time new message received:', payload.new);
              fetchMessages(selectedConversation.id);
            }
          }
        )
        .subscribe();

      // Also update read status for messages in this conversation
      const updateReadStatus = async () => {
        try {
          const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', selectedConversation.id)
            .eq('recipient_id', userId)
            .eq('is_read', false); // Only update unread messages
            
          if (error) {
            console.error('Error updating read status:', error);
          } else {
            // Refresh conversations to update unread counts - but don't trigger a full refresh
            setConversations(prev => 
              prev.map(conv => 
                conv.id === selectedConversation.id 
                  ? { ...conv, hasUnread: false, unreadCount: 0 }
                  : conv
              )
            );
          }
        } catch (error) {
          console.error('Error updating read status:', error);
        }
      };
      
      // Mark messages as read
      updateReadStatus();
      
      return () => {
        // Clean up subscription when component unmounts or conversation changes
        supabase.removeChannel(messagesSubscription);
      };
    } catch (error) {
      console.error('Error setting up conversation:', error);
      setError('Failed to load messages. Please try again.');
    }
  }, [selectedConversation, userId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedConversation) return;
    
    // Store message text before clearing input
    const messageText = newMessage.trim();
    
    // Clear input field right away for better UX
    setNewMessage('');
    
    try {
      const otherParticipantId = 
        selectedConversation.participant_one === userId 
          ? selectedConversation.participant_two
          : selectedConversation.participant_one;
      
      // Optimistically update the UI
      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        id: tempId,
        conversation_id: selectedConversation.id,
        sender_id: userId,
        recipient_id: otherParticipantId,
        message_text: messageText,
        apartment_id: selectedConversation.apartment_id,
        created_at: new Date().toISOString(),
        is_read: false,
        profiles: { 
          full_name: 'You',
          avatar_url: null // Explicitly set to null to prevent errors
        }
      };
      
      // Reset userHasScrolled to ensure auto-scroll when sending new messages
      setUserHasScrolled(false);
      
      // Update UI immediately
      setMessages(current => [...current, tempMessage]);
      
      // Scroll to bottom after sending (even before server response)
      setTimeout(scrollToBottom, 50);
      
      // Send to database (don't await this to prevent blocking UI)
      supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: userId,
          recipient_id: otherParticipantId,
          message_text: messageText,
          apartment_id: selectedConversation.apartment_id
        })
        .select()
        .then(({ data, error }) => {
          if (error) {
            console.error('Error inserting message:', error);
            // Remove the temporary message if there was an error
            setMessages(current => current.filter(msg => msg.id !== tempId));
            throw error;
          }
          
          // Success case - replace temp message with real one if needed
          if (data && data[0]) {
            setMessages(current => 
              current.map(msg => msg.id === tempId ? 
                {...data[0], profiles: { full_name: 'You', avatar_url: null }} : msg
              )
            );
          }
          
          // Update conversation last updated time (don't wait for this)
          return supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', selectedConversation.id);
        })
        .then(() => {
          // Don't trigger a full fetch - this causes the UI glitches
          // Instead, just update the local state of this conversation
          setConversations(prev => {
            const updatedConvs = prev.map(c => {
              if (c.id === selectedConversation.id) {
                return {
                  ...c,
                  lastMessage: {
                    message_text: messageText,
                    created_at: new Date().toISOString(),
                    sender_id: userId
                  },
                  updated_at: new Date().toISOString()
                };
              }
              return c;
            });
            
            // Sort conversations by updated_at
            return [...updatedConvs].sort((a, b) => 
              new Date(b.updated_at) - new Date(a.updated_at)
            );
          });
        })
        .catch(err => {
          console.error('Error in message transaction:', err);
          alert('Could not send your message. Please try again later.');
        });
        
    } catch (error) {
      console.error('Error sending message:', error);
      // Show a more user-friendly error
      alert('Could not send your message. Please try again later.');
    }
  };

  if (loading && initialLoading) {
    return <LoadingSpinner size="lg" />;
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded-md">
        <p>Error: {error}</p>
      </div>
    );
  }

  // Helper function to display the other participant's name (apartment owner)
  const getOwnerName = (conversation) => {
    if (!conversation?.otherParticipant) return 'Owner';
    return conversation.otherParticipant.full_name || 'Owner';
  };

  // Format date for messages
  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    } else {
      return date.toLocaleDateString([], {month: 'short', day: 'numeric'}) + 
             ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    }
  };

  return (
    <div className="relative">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
        <div className="flex h-[500px] md:h-[600px]">
          {/* Conversations List - Left Panel (hidden on mobile when viewing a conversation) */}
          <div className={`${
            showConversations ? 'block' : 'hidden'
          } md:block w-full md:w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col`}>
            <div className="p-3 md:p-4 border-b border-gray-200 bg-white">
              <h3 className="font-medium text-lg text-gray-800">Conversations</h3>
            </div>
            
            <div className="overflow-y-auto flex-grow scrollbar-custom" style={{ height: 'calc(100% - 60px)', scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
              {loading && (
                <div className="p-8 flex justify-center">
                  <LoadingSpinner />
                </div>
              )}
              
              {!loading && conversations.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="mb-3">No conversations yet</p>
                  <Link 
                    to="/"
                    className="inline-flex items-center text-blue-600 hover:text-blue-700"
                  >
                    <span>Browse apartments</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              )}
              
              {!loading && conversations.map((conversation) => (
                <motion.div 
                  key={conversation.id}
                  className={`p-3 md:p-4 border-b border-gray-200 cursor-pointer transition-colors duration-150 
                    ${selectedConversation?.id === conversation.id 
                      ? 'bg-blue-50' 
                      : 'hover:bg-gray-100'
                    }
                    ${conversation.hasUnread 
                      ? 'border-l-4 border-l-blue-500' 
                      : 'border-l-4 border-l-transparent'
                    }`}
                  onClick={() => setSelectedConversation(conversation)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center mb-1">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex-shrink-0 flex items-center justify-center text-white font-bold overflow-hidden">
                      {conversation.otherParticipant?.avatar_url ? (
                        <img 
                          src={conversation.otherParticipant.avatar_url}
                          alt={getOwnerName(conversation)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/images/default-avatar.svg';
                          }}
                        />
                      ) : (
                        getOwnerName(conversation).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="ml-3 flex-grow overflow-hidden">
                      <h4 className={`font-medium truncate ${conversation.hasUnread ? 'text-black' : 'text-gray-700'}`}>
                        {getOwnerName(conversation)}
                      </h4>
                      <p className="text-xs text-gray-500 truncate">
                        {conversation.apartments?.title || 'Unknown property'}
                      </p>
                    </div>
                    {conversation.lastMessage && (
                      <div className="text-xs text-gray-500 flex-shrink-0">
                        {new Date(conversation.lastMessage.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    )}
                  </div>
                  
                  {conversation.lastMessage && (
                    <div className="mt-1 pl-13">
                      <p className={`text-sm text-gray-600 truncate ${conversation.hasUnread ? 'font-medium' : ''}`}>
                        {conversation.lastMessage.sender_id === userId ? 'You: ' : ''}
                        {conversation.lastMessage.message_text}
                      </p>
                    </div>
                  )}
                  
                  {conversation.hasUnread && (
                    <div className="flex justify-end mt-1">
                      <div className="bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {conversation.unreadCount}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* Messages Area - Right Panel (full width on mobile) */}
          <div className={`${
            showConversations ? 'hidden' : 'block'
          } md:block w-full md:w-2/3 flex flex-col`}>
            {selectedConversation ? (
              <>
                {/* Conversation Header */}
                <div className="p-3 md:p-4 border-b border-gray-200 flex items-center bg-white">
                  {/* Back button - Only on mobile */}
                  <button 
                    onClick={handleBackToConversations}
                    className="md:hidden mr-2 text-gray-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white mr-3 overflow-hidden">
                    {selectedConversation.otherParticipant?.avatar_url ? (
                      <img 
                        src={selectedConversation.otherParticipant.avatar_url}
                        alt={getOwnerName(selectedConversation)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/images/default-avatar.svg';
                        }}
                      />
                    ) : (
                      getOwnerName(selectedConversation).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 truncate">
                      {getOwnerName(selectedConversation)}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">
                      {selectedConversation.apartments?.title || 'Unknown property'}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <Link 
                      to={`/apartments/${selectedConversation.apartment_id}`}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                    >
                      <span className="hidden sm:inline-block">View property</span>
                      <span className="sm:hidden">View</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>
                  </div>
                </div>
                
                {/* Messages */}
                <div 
                  className="flex-grow p-3 md:p-4 overflow-y-auto bg-gradient-to-b from-gray-50 to-white h-[60vh] md:h-[70vh] scrollbar-custom"
                  ref={messageContainerRef}
                  style={{ scrollBehavior: 'smooth', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
                >
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-center mb-2">No messages yet</p>
                      <p className="text-center text-sm">Start the conversation by sending a message below</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg, index) => {
                        if (!msg || !msg.created_at) return null;
                        
                        // Group messages by day
                        const showDateDivider = index === 0 || 
                          new Date(msg.created_at).toDateString() !== 
                          new Date(messages[index-1]?.created_at || '').toDateString();
                        
                        return (
                          <React.Fragment key={msg.id || `msg-${index}`}>
                            {showDateDivider && (
                              <div className="flex justify-center my-4">
                                <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                                  {new Date(msg.created_at).toLocaleDateString([], {
                                    weekday: 'short',
                                    month: 'short', 
                                    day: 'numeric'
                                  })}
                                </div>
                              </div>
                            )}
                            
                                                          <motion.div 
                              className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              layout
                            >
                              {/* Show avatar for recipient's messages */}
                              {msg.sender_id !== userId && (
                                <div className="w-8 h-8 rounded-full bg-gray-300 flex-shrink-0 mr-2 flex items-center justify-center text-white font-medium text-xs overflow-hidden">
                                  {msg.profiles?.avatar_url ? (
                                    <img 
                                      src={msg.profiles.avatar_url}
                                      alt={msg.profiles?.full_name || 'User'}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = '/images/default-avatar.svg';
                                      }}
                                    />
                                  ) : (
                                    (msg.profiles?.full_name || 'U').charAt(0).toUpperCase()
                                  )}
                                </div>
                              )}
                              
                              <div 
                                className={`relative max-w-[85%] md:max-w-[75%] rounded-lg px-3 md:px-4 py-2 shadow-sm
                                  ${msg.sender_id === userId 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : msg.isUnread
                                      ? 'bg-indigo-50 border-l-4 border-indigo-500 text-gray-800 rounded-bl-none'
                                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                                  }`}
                              >
                                {/* Show name for recipient's messages */}
                                {msg.sender_id !== userId && (
                                  <div className="text-xs font-medium mb-1">
                                    {msg.profiles?.full_name || 'User'}
                                  </div>
                                )}
                                
                                <p className="whitespace-pre-wrap break-words text-sm">
                                  {msg.message_text || ''}
                                </p>
                                
                                <div className={`text-xs mt-1 flex items-center justify-end
                                  ${msg.sender_id === userId ? 'text-blue-200' : 'text-gray-500'}`}
                                >
                                  {formatMessageTime(msg.created_at)}
                                  
                                  {/* Read status for sender's messages */}
                                  {msg.sender_id === userId && (
                                    <span className="ml-1">
                                      {msg.is_read ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                                        </svg>
                                      )}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Unread indicator */}
                                {msg.isUnread && (
                                  <div className="absolute top-0 right-0 transform -translate-y-1/2 translate-x-1/2">
                                    <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </React.Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                  
                  {/* Scroll to bottom button */}
                  <AnimatePresence>
                    {showScrollBtn && (
                      <motion.button 
                        className="absolute bottom-24 right-4 bg-blue-600 text-white rounded-full p-2 shadow-md"
                        onClick={scrollToBottom}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Message Input */}
                <div className="p-2 md:p-3 border-t border-gray-200 bg-white">
                  <form onSubmit={handleSendMessage} className="flex items-center">
                    <div className="flex-grow relative rounded-lg overflow-hidden border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="w-full px-3 py-2 md:px-4 md:py-3 focus:outline-none text-sm"
                        placeholder="Type your message..."
                      />
                    </div>
                    <motion.button
                      type="submit"
                      className="ml-2 md:ml-3 flex-shrink-0 w-9 h-9 md:w-10 md:h-10 bg-blue-600 text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!newMessage.trim()}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </motion.button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 bg-gray-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <h3 className="text-xl font-medium text-gray-700 mb-2">Your Messages</h3>
                <p className="text-center mb-6">
                  {conversations.length > 0 
                    ? 'Select a conversation to view messages' 
                    : 'No conversations yet. Explore properties to start chatting!'}
                </p>
                {conversations.length === 0 && (
                  <Link 
                    to="/" 
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md"
                  >
                    Browse Apartments
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 