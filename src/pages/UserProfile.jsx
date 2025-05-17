import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function UserProfile() {
  const { user, userRole, logout, ownerStatus, refreshOwnerStatus, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
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

  // Fetch user data
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 text-red-700 p-4 rounded-md text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
          <p className="text-gray-600">Manage your account settings and saved apartments</p>
        </div>
        
        {/* Tabs */}
        <div className="px-6 py-2 bg-white border-b border-gray-200">
          <div className="flex space-x-4">
            <button
              className={`px-4 py-2 font-medium rounded-md transition-colors ${
                activeTab === 'profile' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
            <button
              className={`px-4 py-2 font-medium rounded-md transition-colors ${
                activeTab === 'saved' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('saved')}
            >
              Saved Apartments
            </button>
            <button
              className={`px-4 py-2 font-medium rounded-md transition-colors ${
                activeTab === 'messages' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('messages')}
            >
              Messages
            </button>
            <button
              className={`px-4 py-2 font-medium rounded-md transition-colors ${
                activeTab === 'settings' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('settings')}
            >
              Account Settings
            </button>
          </div>
        </div>
        
        {/* Content area */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <div>
              {/* Owner application status */}
              <OwnerApplicationStatus />

              {/* Update success message */}
              {updateSuccess && (
                <div className="mb-6 bg-green-100 text-green-700 p-3 rounded-md">
                  Profile updated successfully!
                </div>
              )}
              
              {/* Update error message */}
              {updateError && (
                <div className="mb-6 bg-red-100 text-red-700 p-3 rounded-md">
                  {updateError}
                </div>
              )}
              
              {/* Profile form */}
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="flex items-center space-x-6 mb-4">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100">
                    {avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt={fullName || 'User Avatar'} 
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-2xl text-gray-400">
                        {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    
                    <label 
                      htmlFor="avatar" 
                      className="absolute bottom-0 w-full py-1 bg-black bg-opacity-50 text-white text-xs text-center cursor-pointer"
                    >
                      Change
                    </label>
                    <input 
                      type="file"
                      id="avatar"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                  
                  <div>
                    <h2 className="text-xl font-semibold">{fullName || 'No Name Set'}</h2>
                    <p className="text-gray-500">{user.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Your full name"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      WhatsApp Number
                    </label>
                    <input
                      id="whatsappNumber"
                      type="text"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g. +252 61 1234567"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Add your WhatsApp number for easier communication with property owners
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between pt-4">
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                  >
                    {updating && (
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    Update Profile
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="px-6 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {activeTab === 'saved' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Saved Apartments</h2>
              
              {savedApartments.length === 0 ? (
                <div className="bg-gray-50 p-6 rounded-lg text-center">
                  <p className="text-gray-600 mb-4">You haven't saved any apartments yet.</p>
                  <Link
                    to="/"
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-block"
                  >
                    Browse Apartments
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedApartments.map((item) => (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      <Link to={`/apartments/${item.apartment_id}`}>
                        <div className="h-40 bg-gray-200 relative">
                          {item.apartments.apartment_images?.[0]?.storage_path ? (
                            <img
                              src={supabase.storage.from('apartment_images').getPublicUrl(
                                item.apartments.apartment_images[0].storage_path
                              ).data.publicUrl}
                              alt={item.apartments.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              No Image Available
                            </div>
                          )}
                          {!item.apartments.is_available && (
                            <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-1 m-2 rounded">
                              Not Available
                            </div>
                          )}
                        </div>
                      </Link>
                      
                      <div className="p-4">
                        <Link to={`/apartments/${item.apartment_id}`}>
                          <h3 className="font-medium text-lg mb-1 hover:text-blue-600 transition-colors">
                            {item.apartments.title}
                          </h3>
                        </Link>
                        <p className="text-sm text-gray-500 mb-2">{item.apartments.location_description}</p>
                        <div className="flex justify-between items-center mb-3">
                          <div className="font-semibold text-lg">${item.apartments.price_per_month}/month</div>
                          <div className="text-sm text-gray-500">
                            {item.apartments.rooms} bed • {item.apartments.bathrooms} bath
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <Link
                            to={`/apartments/${item.apartment_id}`}
                            className="text-blue-600 text-sm hover:underline"
                          >
                            View Details
                          </Link>
                          <button
                            onClick={() => handleRemoveSaved(item.id)}
                            className="text-red-600 text-sm hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'messages' && (
            <MessagesTab userId={user.id} />
          )}
        </div>
      </div>
    </div>
  );
}

// Messages component for regular users
const MessagesTab = ({ userId }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      
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
      
      if (conversationsData && conversationsData.length > 0) {
        // Extract all unique participant IDs
        const participantIds = new Set();
        const ownerIds = new Set();
        
        conversationsData.forEach(conv => {
          participantIds.add(conv.participant_one);
          participantIds.add(conv.participant_two);
          if (conv.apartments && conv.apartments.owner_id) {
            ownerIds.add(conv.apartments.owner_id);
          }
        });
        
        // Fetch profiles for all participants
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', Array.from(participantIds));
          
        if (profilesError) throw profilesError;
        
        // Create a map of profiles by ID for easy lookup
        const profilesMap = (profilesData || []).reduce((map, profile) => {
          map[profile.id] = profile;
          return map;
        }, {});
        
        // Add profile data to conversations
        const enrichedConversations = conversationsData.map(conv => ({
          ...conv,
          profiles: {
            participant_one_fkey: profilesMap[conv.participant_one] || null,
            participant_two_fkey: profilesMap[conv.participant_two] || null,
            owner_profile: profilesMap[conv.apartments?.owner_id] || null
          }
        }));
        
        setConversations(enrichedConversations);
      } else {
        setConversations([]);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch conversations initially and set up refresh
  useEffect(() => {
    fetchConversations();
    
    // Set up realtime subscription for conversations
    const conversationsSubscription = supabase
      .channel('public:conversations')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'conversations',
          filter: `participant_one=eq.${userId}` 
        },
        () => {
          fetchConversations();
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'conversations',
          filter: `participant_two=eq.${userId}` 
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(conversationsSubscription);
    };
  }, [userId]);

  const fetchMessages = async (conversationId) => {
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
          .select('id, full_name')
          .in('id', senderIds);
        
        if (profilesError) throw profilesError;
        
        // Create a map of profiles by ID
        const profilesMap = (profilesData || []).reduce((map, profile) => {
          map[profile.id] = profile;
          return map;
        }, {});
        
        // Add profiles to messages
        const enrichedMessages = messagesData.map(msg => ({
          ...msg,
          profiles: profilesMap[msg.sender_id] || null
        }));
        
        setMessages(enrichedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    }
  };

  useEffect(() => {
    if (!selectedConversation) return;
    
    fetchMessages(selectedConversation.id);
    
    // Set up realtime subscription for new messages
    const messagesSubscription = supabase
      .channel('public:messages')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}` 
        },
        () => {
          // Fetch the full message with profile data
          fetchMessages(selectedConversation.id);
        }
      )
      .subscribe();

    // Also update read status for messages in this conversation
    const updateReadStatus = async () => {
      try {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', selectedConversation.id)
          .eq('recipient_id', userId);
      } catch (error) {
        console.error('Error updating read status:', error);
      }
    };
    
    updateReadStatus();
    
    return () => {
      supabase.removeChannel(messagesSubscription);
    };
  }, [selectedConversation, userId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedConversation) return;
    
    try {
      const otherParticipantId = 
        selectedConversation.participant_one === userId 
          ? selectedConversation.participant_two
          : selectedConversation.participant_one;
      
      // Optimistically update the UI
      const tempMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: selectedConversation.id,
        sender_id: userId,
        recipient_id: otherParticipantId,
        message_text: newMessage,
        apartment_id: selectedConversation.apartment_id,
        created_at: new Date().toISOString(),
        is_read: false,
        profiles: { 
          full_name: 'You'
        }
      };
      
      // Update UI immediately
      setMessages(current => [...current, tempMessage]);
      
      // Clear input field right away
      setNewMessage('');
      
      // Send to database
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: userId,
          recipient_id: otherParticipantId,
          message_text: newMessage,
          apartment_id: selectedConversation.apartment_id
        });
      
      if (error) throw error;
      
      // Also update conversation's updated_at field
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);
      
      // Update conversations list to reflect the new message
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  if (loading) {
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
    if (!conversation.profiles) return 'Owner';
    
    // Get the other participant (not the current user)
    if (conversation.participant_one === userId) {
      return conversation.profiles.participant_two_fkey?.full_name || 'Owner';
    } else {
      return conversation.profiles.participant_one_fkey?.full_name || 'Owner';
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">My Messages</h2>
      <div className="flex h-[500px] rounded-lg overflow-hidden border border-gray-200">
        {/* Conversations List */}
        <div className="w-1/3 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-800">Conversations</h3>
          </div>
          
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>You have no message conversations yet.</p>
              <p className="mt-2 text-sm">Start a conversation by contacting an apartment owner!</p>
            </div>
          ) : (
            <div>
              {conversations.map((conversation) => (
                <div 
                  key={conversation.id}
                  className={`p-3 cursor-pointer border-b border-gray-100 hover:bg-gray-100 transition-colors ${
                    selectedConversation?.id === conversation.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-gray-800">
                      {getOwnerName(conversation)}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {new Date(conversation.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-1">
                    {conversation.apartments?.title || 'Unknown property'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Message Area */}
        <div className="w-2/3 flex flex-col bg-white">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-800">
                    {getOwnerName(selectedConversation)}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedConversation.apartments?.title || 'Unknown property'}
                  </p>
                </div>
              </div>
              
              <div className="flex-grow p-4 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 my-8">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`max-w-3/4 rounded-lg px-4 py-2 ${
                            msg.sender_id === userId 
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          <p>{msg.message_text}</p>
                          <p className={`text-xs mt-1 ${
                            msg.sender_id === userId ? 'text-blue-200' : 'text-gray-500'
                          }`}>
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                <div className="flex">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Type your message..."
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!newMessage.trim()}
                  >
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select a conversation to view messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 