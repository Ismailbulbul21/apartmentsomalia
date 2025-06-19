import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function AuthCallback() {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const { handleAuthCallback } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setStatus('processing');
        
        // Add a small delay to ensure URL parameters are available
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
        console.error('Auth callback error:', err);
        setStatus('error');
        setError(err.message || 'An unexpected error occurred');
      }
    };

    handleCallback();
  }, [handleAuthCallback, navigate, retryCount]);

  const handleRetry = () => {
    if (retryCount < 2) { // Allow up to 2 retries
      setRetryCount(prev => prev + 1);
      setStatus('processing');
      setError('');
    } else {
      // After 2 retries, redirect to login
      navigate('/login', { replace: true });
    }
  };

  const handleBackToLogin = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-night-950 to-night-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-night-800 rounded-xl shadow-2xl border border-night-700 text-center">
        {status === 'processing' && (
          <>
            <LoadingSpinner />
            <h2 className="text-xl font-semibold text-white mt-4">
              {retryCount > 0 ? 'Retrying sign-in...' : 'Completing sign-in...'}
            </h2>
            <p className="text-night-400">
              {retryCount > 0 
                ? `Attempt ${retryCount + 1} of 3` 
                : 'Please wait while we finish setting up your account.'
              }
            </p>
            {retryCount === 0 && (
              <div className="mt-4">
                <div className="text-xs text-night-500">
                  This usually takes just a few seconds
                </div>
              </div>
            )}
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
            <p className="text-red-400 mb-6">
              {error}
            </p>
            
            <div className="space-y-3">
              {retryCount < 2 ? (
                <button
                  onClick={handleRetry}
                  className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Try Again ({2 - retryCount} attempts left)
                </button>
              ) : null}
              
              <button
                onClick={handleBackToLogin}
                className="w-full px-6 py-3 bg-night-700 text-white rounded-lg hover:bg-night-600 transition-colors border border-night-600"
              >
                Back to Login
              </button>
            </div>
            
            <div className="mt-6 text-xs text-night-500">
              <p>Common issues:</p>
              <ul className="mt-2 space-y-1 text-left">
                <li>• Popup blockers preventing sign-in</li>
                <li>• Third-party cookies disabled</li>
                <li>• Network connectivity issues</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 