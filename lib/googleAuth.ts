import { Platform } from 'react-native';

// Conditional import for native platforms
let GoogleSignin: any;
let statusCodes: any;

try {
  if (Platform.OS !== 'web') {
    const googleSignin = require('@react-native-google-signin/google-signin');
    GoogleSignin = googleSignin.GoogleSignin;
    statusCodes = googleSignin.statusCodes;
  }
} catch (error) {
  console.log('Google Sign In native module not available, using web fallback');
}

// Google OAuth Configuration - Using environment variables
const GOOGLE_CONFIG = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '645905000706-84poben7qoa735imq8ukp765ho5k0d97.apps.googleusercontent.com',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '645905000706-r5d9rejr3lakueqrhl1tk7ldmpv2jt2v.apps.googleusercontent.com',
  iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com', // Your iOS Client ID (when you have one)
  offlineAccess: true,
  forceCodeForRefreshToken: true,
  scopes: ['openid', 'profile', 'email'],
};

// Configure Google Sign In
export const configureGoogleSignIn = async () => {
  try {
    if (Platform.OS === 'web') {
      // Web configuration - no configuration needed for manual OAuth flow
      console.log('Google Sign In configured for web');
      return;
    }
    
    if (GoogleSignin) {
      GoogleSignin.configure({
        webClientId: GOOGLE_CONFIG.webClientId,
        iosClientId: GOOGLE_CONFIG.iosClientId,
        offlineAccess: GOOGLE_CONFIG.offlineAccess,
        forceCodeForRefreshToken: GOOGLE_CONFIG.forceCodeForRefreshToken,
      });
    }
  } catch (error) {
    console.error('Google SignIn configuration error:', error);
    throw error;
  }
};

// Google Sign In Hook with OAuth 2.0 flow
export const useGoogleAuth = () => {
  const signIn = async () => {
    try {
      if (Platform.OS === 'web') {
        // For web, use standard OAuth 2.0 flow
        return await initiateWebGoogleAuth();
      }
      
      // For native apps, try native module first, fallback to web OAuth
      if (GoogleSignin) {
        try {
          // Configure Google SignIn if not already configured
          await configureGoogleSignIn();
          
          // Check if device has Google Play Services (Android)
          await GoogleSignin.hasPlayServices();
          
          // Sign in
          const userInfo = await GoogleSignin.signIn();
          
          return {
            type: 'success',
            user: userInfo.data?.user || userInfo,
            tokens: userInfo,
          };
        } catch (error: any) {
          console.warn('Native Google Sign In failed, falling back to web OAuth:', error);
          
          if (statusCodes && error.code === statusCodes.SIGN_IN_CANCELLED) {
            return { type: 'cancelled' };
          }
          
          // Fall back to web OAuth for other errors
          return await initiateWebGoogleAuth();
        }
      } else {
        // Native module not available, use web OAuth
        return await initiateWebGoogleAuth();
      }
    } catch (error: any) {
      console.error('Google Sign In error:', error);
      return { type: 'error', error: error.message };
    }
  };

  return { 
    request: true, // Always ready
    response: null, // Not used in this implementation
    promptAsync: signIn,
  };
};

// Web OAuth 2.0 flow implementation
const initiateWebGoogleAuth = async () => {
  try {
    const clientId = GOOGLE_CONFIG.webClientId;
    const redirectUri = Platform.OS === 'web' ? `${window.location.origin}/auth/callback` : 'com.mojzi1969.equihub://oauth/callback';
    
    // Create OAuth 2.0 authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    
    if (Platform.OS === 'web') {
      // For web, open popup window
      return await openGoogleAuthPopup(authUrl.toString(), redirectUri);
    } else {
      // For mobile, use in-app browser
      const { WebBrowser } = require('expo-web-browser');
      const result = await WebBrowser.openAuthSessionAsync(authUrl.toString(), redirectUri);
      
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        
        if (code) {
          // Exchange code for user info via server
          const { AuthAPI } = require('./authAPI');
          const authResult = await AuthAPI.googleOAuth(code, redirectUri);
          
          if (authResult.error) {
            return { type: 'error', error: authResult.error };
          }
          
          return {
            type: 'success',
            user: authResult.user,
          };
        }
      }
      
      return { type: 'cancelled' };
    }
  } catch (error: any) {
    console.error('Web Google Auth error:', error);
    return { type: 'error', error: error.message };
  }
};

// Web popup implementation
const openGoogleAuthPopup = async (authUrl: string, redirectUri: string) => {
  return new Promise((resolve) => {
    const popup = window.open(
      authUrl,
      'google-auth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );
    
    if (!popup) {
      resolve({ type: 'error', error: 'Popup blocked. Please allow popups for this site.' });
      return;
    }
    
    // Listen for the callback
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        resolve({ type: 'cancelled' });
      }
      
      try {
        if (popup.location.href.startsWith(redirectUri)) {
          const url = new URL(popup.location.href);
          const code = url.searchParams.get('code');
          
          popup.close();
          clearInterval(checkClosed);
          
          if (code) {
            // Exchange code for user info via server
            const { AuthAPI } = require('./authAPI');
            AuthAPI.googleOAuth(code, redirectUri).then((authResult: any) => {
              if (authResult.error) {
                resolve({ type: 'error', error: authResult.error });
              } else {
                resolve({
                  type: 'success',
                  user: authResult.user,
                });
              }
            }).catch((error: any) => {
              resolve({ type: 'error', error: error.message });
            });
          } else {
            resolve({ type: 'error', error: 'No authorization code received' });
          }
        }
      } catch (e) {
        // Cross-origin error - popup is still on Google's domain
      }
    }, 1000);
    
    // Timeout after 5 minutes
    setTimeout(() => {
      if (!popup.closed) {
        popup.close();
      }
      clearInterval(checkClosed);
      resolve({ type: 'error', error: 'Authentication timeout' });
    }, 300000);
  });
};

export const fetchGoogleUserInfo = async (user: any) => {
  // With react-native-google-signin, user info is already available
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    given_name: user.givenName,
    family_name: user.familyName,
    picture: user.photo,
    locale: 'en', // Default locale
  };
};

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}