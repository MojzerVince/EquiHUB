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

// Google OAuth Configuration
const GOOGLE_CONFIG = {
  webClientId: '645905000706-84poben7qoa735imq8ukp765ho5k0d97.apps.googleusercontent.com', // Your Web Client ID
  androidClientId: '645905000706-r5d9rejr3lakueqrhl1tk7ldmpv2jt2v.apps.googleusercontent.com', // Your Android Client ID
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

// Google Sign In Hook (replacing useAuthRequest)
export const useGoogleAuth = () => {
  const signIn = async () => {
    try {
      if (Platform.OS === 'web') {
        // For web, show a message that Google Sign In is not available in development
        return { 
          type: 'error', 
          error: 'Google Sign In is not available in web development mode. Please use email/password login for testing.' 
        };
      }
      
      // Configure Google SignIn if not already configured
      await configureGoogleSignIn();
      
      if (!GoogleSignin) {
        return { type: 'error', error: 'Google Sign In not available' };
      }
      
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
      console.error('Google Sign In error:', error);
      
      if (statusCodes && error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { type: 'cancelled' };
      } else if (statusCodes && error.code === statusCodes.IN_PROGRESS) {
        return { type: 'in_progress' };
      } else if (statusCodes && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { type: 'play_services_not_available' };
      } else {
        return { type: 'error', error: error.message };
      }
    }
  };

  return { 
    request: true, // Always ready
    response: null, // Not used in this implementation
    promptAsync: signIn,
  };
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