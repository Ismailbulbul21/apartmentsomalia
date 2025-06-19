// Authentication debugging utilities

export const logAuthState = (context, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🔐 Auth Debug: ${context}`);
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL:', window.location.href);
    console.log('Data:', data);
    console.groupEnd();
  }
};

export const checkBrowserSupport = () => {
  const issues = [];
  
  // Check for popup blocker
  try {
    const popup = window.open('', 'test', 'width=1,height=1');
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      issues.push('Popup blocker may be enabled');
    } else {
      popup.close();
    }
  } catch (e) {
    issues.push('Popup functionality blocked');
  }
  
  // Check for third-party cookies
  if (!navigator.cookieEnabled) {
    issues.push('Cookies are disabled');
  }
  
  // Check for localStorage
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
  } catch (e) {
    issues.push('Local storage is not available');
  }
  
  // Check for sessionStorage
  try {
    sessionStorage.setItem('test', 'test');
    sessionStorage.removeItem('test');
  } catch (e) {
    issues.push('Session storage is not available');
  }
  
  return {
    supported: issues.length === 0,
    issues
  };
};

export const getOAuthErrorInfo = (error) => {
  const errorMap = {
    'access_denied': 'User cancelled the sign-in process',
    'invalid_request': 'Invalid OAuth request parameters',
    'unauthorized_client': 'OAuth client not authorized',
    'unsupported_response_type': 'OAuth response type not supported',
    'invalid_scope': 'Invalid OAuth scope requested',
    'server_error': 'OAuth server error occurred',
    'temporarily_unavailable': 'OAuth service temporarily unavailable'
  };
  
  return errorMap[error] || `OAuth error: ${error}`;
};

export const diagnoseAuthIssue = () => {
  const diagnosis = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    browserSupport: checkBrowserSupport(),
    urlParams: Object.fromEntries(new URLSearchParams(window.location.search)),
    localStorage: {},
    sessionStorage: {}
  };
  
  // Check for auth-related items in storage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('auth') || key.includes('user') || key.includes('supabase'))) {
        diagnosis.localStorage[key] = localStorage.getItem(key);
      }
    }
  } catch (e) {
    diagnosis.localStorage.error = e.message;
  }
  
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('auth') || key.includes('user') || key.includes('supabase'))) {
        diagnosis.sessionStorage[key] = sessionStorage.getItem(key);
      }
    }
  } catch (e) {
    diagnosis.sessionStorage.error = e.message;
  }
  
  return diagnosis;
};

export const clearAuthCache = () => {
  try {
    // Clear auth-related localStorage items
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('auth') || key.includes('user') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear auth-related sessionStorage items
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('auth') || key.includes('user') || key.includes('supabase'))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    console.log('Auth cache cleared successfully');
    return true;
  } catch (e) {
    console.error('Failed to clear auth cache:', e);
    return false;
  }
}; 