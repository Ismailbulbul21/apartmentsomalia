import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from 'react-error-boundary';

// Helper function to clear potentially corrupted auth data
const clearPotentiallyCorruptedAuth = () => {
  try {
    // Check for obvious corruption in localStorage
    const keysToCheck = [
      'supabase.auth.token',
      'apartments-auth-token',
      'supabase-auth-token'
    ];
    
    let hasCorrupted = false;
    
    keysToCheck.forEach(key => {
      try {
        const storedValue = localStorage.getItem(key);
        if (storedValue && 
            (storedValue === 'undefined' || 
             storedValue === 'null' || 
             storedValue === '[object Object]' ||
             storedValue.includes('undefined') ||
             storedValue.length < 10)) {
          console.warn(`Potentially corrupted auth data found in ${key}, removing...`);
          localStorage.removeItem(key);
          hasCorrupted = true;
        }
      } catch (e) {
        console.error(`Error checking ${key}:`, e);
      }
    });
    
    // Clear any user_role_ entries if we found corruption
    if (hasCorrupted) {
      Object.keys(localStorage)
        .filter(key => key.startsWith('user_role_'))
        .forEach(key => localStorage.removeItem(key));
    }
  } catch (e) {
    console.error('Error clearing potentially corrupted auth data:', e);
  }
};

// Clear potentially corrupted auth data on load
clearPotentiallyCorruptedAuth();

// Register event listener for beforeunload to prevent page cache issues
window.addEventListener('beforeunload', () => {
  // Set a flag to indicate normal navigation
  try {
    sessionStorage.setItem('cleanExit', 'true');
  } catch (e) {
    console.warn('Error setting session storage item:', e);
  }
});

// Custom error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 max-w-md bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl text-red-600 font-bold mb-4">Something went wrong</h2>
        <p className="text-gray-700 mb-4">We're sorry, but there was an error loading this page.</p>
        <pre className="text-left bg-gray-100 p-2 rounded text-xs overflow-auto mb-4" style={{ maxHeight: '200px' }}>
          {error.message}
        </pre>
        <button
          onClick={() => {
            // Clear auth related data before resetting
            clearPotentiallyCorruptedAuth();
            resetErrorBoundary();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
};

// Check if we had a clean exit previously
const hadCleanExit = () => {
  try {
    return sessionStorage.getItem('cleanExit') === 'true';
  } catch (e) {
    return false;
  }
};

// Clear the clean exit flag
try {
  sessionStorage.removeItem('cleanExit');
} catch (e) {
  console.warn('Error removing session storage item:', e);
}

// If we didn't have a clean exit, clear potentially corrupted auth data again
if (!hadCleanExit()) {
  console.warn('Detected possible abrupt page close, checking auth state...');
  clearPotentiallyCorruptedAuth();
}

// Render app with error boundary
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
); 