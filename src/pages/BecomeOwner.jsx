import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function BecomeOwner() {
  const { user, becomeOwner, isOwner, ownerStatus, refreshOwnerStatus } = useAuth();
  const navigate = useNavigate();
  
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');

  // Check owner status when component mounts
  useEffect(() => {
    refreshOwnerStatus();
  }, []);

  // If user is already an owner, redirect to owner dashboard
  useEffect(() => {
    if (isOwner()) {
      navigate('/owner/dashboard');
    }
  }, [isOwner]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!businessName || !businessPhone || !businessAddress || !businessDescription) {
      setError('Please fill in all required fields');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      console.log('Submitting owner application with data:', {
        businessName,
        businessPhone,
        businessAddress,
        businessDescription,
        whatsappNumber: whatsappNumber || ''
      });
      
      const response = await becomeOwner({
        businessName,
        businessPhone,
        businessAddress,
        businessDescription,
        whatsappNumber
      });
      
      console.log('Owner application response:', response);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to submit owner request. Please try again.');
      }
      
      // Show success message
      setSuccess(true);
      setPendingMessage(response.message || 'Your request to become an owner has been submitted and is pending admin approval.');
      
      // Clear form
      setBusinessName('');
      setBusinessPhone('');
      setBusinessAddress('');
      setBusinessDescription('');
      setWhatsappNumber('');
      
      // Refresh owner status
      await refreshOwnerStatus();
      
    } catch (error) {
      console.error('Error in BecomeOwner submission:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Renders a status message based on the owner application status
  const renderStatusMessage = () => {
    switch (ownerStatus.requestStatus) {
      case 'pending':
        return (
          <motion.div 
            className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-5 rounded-lg mb-6"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="font-bold text-lg mb-2">Application Under Review</h3>
            <p className="mb-2">
              Your request to become a property owner is currently pending approval from our administrators.
            </p>
            <p className="text-sm">
              Submitted on: {new Date(ownerStatus.createdAt).toLocaleDateString()}
            </p>
          </motion.div>
        );
      
      case 'rejected':
        return (
          <motion.div 
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-5 rounded-lg mb-6"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="font-bold text-lg mb-2">Application Rejected</h3>
            <p className="mb-2">
              Your previous owner application was rejected. You can submit a new application with updated details.
            </p>
            {ownerStatus.rejectionReason && (
              <div className="mt-2 p-3 bg-white rounded">
                <p className="font-medium">Reason:</p>
                <p className="italic">{ownerStatus.rejectionReason}</p>
              </div>
            )}
          </motion.div>
        );
      
      case 'approved':
        return (
          <motion.div 
            className="bg-green-100 border border-green-400 text-green-700 px-4 py-5 rounded-lg mb-6"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="font-bold text-lg mb-2">Application Approved!</h3>
            <p className="mb-3">
              Congratulations! Your application has been approved. You can now access your owner dashboard.
            </p>
            <button
              onClick={() => navigate('/owner/dashboard')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Go to Owner Dashboard
            </button>
          </motion.div>
        );
      
      default:
        return null;
    }
  };

  // Show the application form if the user has no pending request
  const showApplicationForm = !ownerStatus.hasPendingRequest && ownerStatus.requestStatus !== 'approved';

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        className="max-w-3xl mx-auto bg-white rounded-lg shadow-md overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white p-8">
          <h1 className="text-3xl font-bold mb-2">Become a Property Owner</h1>
          <p className="text-blue-100">
            Start listing your properties and connect with potential renters in Mogadishu
          </p>
        </div>
        
        <div className="p-8">
          {/* Display current status message */}
          {renderStatusMessage()}
          
          {/* Error message */}
          {error && (
            <motion.div 
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              <span className="block sm:inline">{error}</span>
            </motion.div>
          )}
          
          {/* Success message */}
          {success && (
            <motion.div 
              className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              <span className="block sm:inline">
                {pendingMessage}
              </span>
            </motion.div>
          )}
          
          {/* Application form */}
          {showApplicationForm && !success && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">
                  Business/Owner Name *
                </label>
                <input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your business or full name"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="businessPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Business Phone Number *
                </label>
                <input
                  id="businessPhone"
                  type="text"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. +252 61 1234567"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  WhatsApp Number (Optional)
                </label>
                <input
                  id="whatsappNumber"
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. +252 61 1234567"
                />
                <p className="mt-1 text-sm text-gray-500">
                  If provided, a WhatsApp contact button will appear on your listings
                </p>
              </div>
              
              <div>
                <label htmlFor="businessAddress" className="block text-sm font-medium text-gray-700 mb-1">
                  Business Address *
                </label>
                <input
                  id="businessAddress"
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your office location in Mogadishu"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="businessDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Business Description *
                </label>
                <textarea
                  id="businessDescription"
                  rows={4}
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Tell us about your business or yourself as a property owner"
                  required
                />
              </div>
              
              <div className="flex items-center">
                <input
                  id="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-gray-700">
                  I agree to the <a href="#" className="text-blue-600 hover:underline">Terms & Conditions</a> for property owners
                </label>
              </div>
              
              <motion.button
                type="submit"
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex justify-center items-center"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  'Submit Owner Application'
                )}
              </motion.button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
} 