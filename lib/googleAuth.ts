import { Platform } from 'react-native';

// Lazy-loaded Google Sign In module to prevent TurboModule errors
let GoogleSignin: any = null;
let statusCodes: any = null;
let googleSignInAvailable = false;

// Generate secure random state parameter for OAuth 2.0 CSRF protection
const generateSecureState = (): string => {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  // Convert to hex string
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Verify state parameter to prevent CSRF attacks
const verifyState = (receivedState: string): boolean => {
  let storedState: string | null = null;
  
  if (Platform.OS === 'web') {
    storedState = sessionStorage.getItem('google_oauth_state');
    sessionStorage.removeItem('google_oauth_state'); // Clean up
  } else {
    storedState = (global as any).__googleOAuthState;
    delete (global as any).__googleOAuthState; // Clean up
  }
  
  if (!storedState || !receivedState) {
    console.error('OAuth state verification failed: missing state parameter');
    return false;
  }
  
  if (storedState !== receivedState) {
    console.error('OAuth state verification failed: state mismatch');
    return false;
  }
  
  return true;
};

// Function to safely initialize Google Sign In module
const initializeGoogleSignInModule = () => {
  if (googleSignInAvailable || GoogleSignin) {
    return true;
  }

  // Only try to import on native platforms and in development builds
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    // Check if we're in Expo Go (which doesn't support native modules)
    const Constants = require('expo-constants');
    const executionEnvironment = Constants.default?.executionEnvironment || Constants.executionEnvironment;
    
    if (executionEnvironment === 'storeClient') {
      console.log('Running in Expo Go - Google Sign In native module not available');
      return false;
    }

    // Additional check for Expo Go using app config
    const appOwnership = Constants.default?.appOwnership || Constants.appOwnership;
    if (appOwnership === 'expo') {
      console.log('Running in Expo Go client - Google Sign In native module not available');
      return false;
    }

    // Try to import the module
    const googleSignin = require('@react-native-google-signin/google-signin');
    GoogleSignin = googleSignin.GoogleSignin;
    statusCodes = googleSignin.statusCodes;
    googleSignInAvailable = true;
    console.log('Google Sign In native module loaded successfully');
    return true;
  } catch (error) {
    console.log('Google Sign In native module not available, using web fallback');
    return false;
  }
};

// Google OAuth Configuration - Using environment variables
const GOOGLE_CONFIG = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
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
      return true;
    }
    
    // Try to initialize the native module
    const isAvailable = initializeGoogleSignInModule();
    
    if (isAvailable && GoogleSignin) {
      // Platform-specific configuration
      const config: any = {
        webClientId: GOOGLE_CONFIG.webClientId,
        offlineAccess: GOOGLE_CONFIG.offlineAccess,
        forceCodeForRefreshToken: GOOGLE_CONFIG.forceCodeForRefreshToken,
      };

      // Add platform-specific client IDs
      if (Platform.OS === 'ios') {
        // iOS only accepts webClientId and iosClientId (if available)
        if (GOOGLE_CONFIG.iosClientId) {
          config.iosClientId = GOOGLE_CONFIG.iosClientId;
        }
      } else if (Platform.OS === 'android') {
        // Android can use androidClientId
        if (GOOGLE_CONFIG.androidClientId) {
          config.androidClientId = GOOGLE_CONFIG.androidClientId;
        }
      }

      // Check if required client ID is available
      if (!config.webClientId) {
        console.warn('Google Web Client ID not configured, Google Sign In may not work properly');
      }

      GoogleSignin.configure(config);
      console.log('Google Sign In configured for native platform:', Platform.OS);
      return true;
    } else {
      console.log('Google Sign In native module not available, will use web OAuth');
      return false;
    }
  } catch (error) {
    console.log('Google SignIn configuration failed, falling back to web OAuth:', error);
    return false;
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
      const nativeAvailable = await configureGoogleSignIn();
      
      if (nativeAvailable && GoogleSignin) {
        try {
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
        console.log('Using web OAuth flow for Google Sign In');
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
    
    if (!clientId) {
      throw new Error('Google Web Client ID not configured. Please check your environment variables.');
    }
    
    // Use Supabase redirect URI for all mobile platforms (works for both Expo Go and standalone builds)
    // This URI is already configured in Google Cloud Console
    let redirectUri: string;
    
    if (Platform.OS === 'web') {
      redirectUri = `${window.location.origin}/auth/callback`;
      console.log('🔍 Running on web - using web redirect URI');
    } else {
      // For all mobile (iOS/Android, Expo Go or standalone), use Supabase callback
      // This is the only HTTPS redirect URI that Google accepts and is already configured
      redirectUri = 'https://grdsqxwghajehneksxik.supabase.co/auth/v1/callback';
      console.log('🔍 Running on mobile - using Supabase redirect URI');
    }
    
    console.log('📍 Using redirect URI:', redirectUri);
    
    // Generate secure random state parameter for CSRF protection
    const state = generateSecureState();
    
    // Store state for verification (in-memory for mobile, sessionStorage for web)
    if (Platform.OS === 'web') {
      sessionStorage.setItem('google_oauth_state', state);
    } else {
      // For mobile, we'll store in a global variable (will be cleared on app restart)
      (global as any).__googleOAuthState = state;
    }
    
    // Create OAuth 2.0 authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state); // Required by Google for security
    
    if (Platform.OS === 'web') {
      // For web, open popup window
      return await openGoogleAuthPopup(authUrl.toString(), redirectUri);
    } else {
      // For mobile, use in-app browser
      try {
        const WebBrowser = require('expo-web-browser');
        
        if (!WebBrowser || !WebBrowser.openAuthSessionAsync) {
          throw new Error('expo-web-browser not available or incomplete');
        }
        
        const result = await WebBrowser.openAuthSessionAsync(authUrl.toString(), redirectUri);
        
        if (result.type === 'success' && result.url) {
          const url = new URL(result.url);
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          
          // Verify state parameter to prevent CSRF attacks
          if (!returnedState || !verifyState(returnedState)) {
            return { 
              type: 'error', 
              error: 'Security validation failed. Please try again.' 
            };
          }
          
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
      } catch (webBrowserError: any) {
        console.error('WebBrowser error:', webBrowserError);
        
        // Provide a more user-friendly error message for Expo Go limitations
        let errorMessage = 'Google Sign In not available in Expo Go. ';
        errorMessage += 'Please use a development build or try the web version.';
        
        return { 
          type: 'error', 
          error: errorMessage,
          details: webBrowserError.message
        };
      }
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
          const returnedState = url.searchParams.get('state');
          
          popup.close();
          clearInterval(checkClosed);
          
          // Verify state parameter to prevent CSRF attacks
          if (!returnedState || !verifyState(returnedState)) {
            resolve({ 
              type: 'error', 
              error: 'Security validation failed. Please try again.' 
            });
            return;
          }
          
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