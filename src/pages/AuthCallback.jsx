import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function AuthCallback() {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');
  const { handleAuthCallback } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setStatus('processing');
        
        const result = await handleAuthCallback();
        
        if (result.success) {
          setStatus('success');
          // Redirect to home page after successful authentication
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 2000);
        } else {
          setStatus('error');
          setError(result.error || 'Authentication failed');
        }
      } catch (err) {
        setStatus('error');
        setError(err.message || 'An unexpected error occurred');
      }
    };

    handleCallback();
  }, [handleAuthCallback, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-night-950 to-night-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-night-800 rounded-xl shadow-2xl border border-night-700 text-center">
        {status === 'processing' && (
          <>
            <LoadingSpinner />
            <h2 className="text-xl font-semibold text-white mt-4">
              Completing sign-in...
            </h2>
            <p className="text-night-400">
              Please wait while we finish setting up your account.
            </p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto bg-green-600 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">
              Sign-in successful!
            </h2>
            <p className="text-night-400">
              Redirecting you to the homepage...
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">
              Sign-in failed
            </h2>
            <p className="text-red-400 mb-4">
              {error}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
} 