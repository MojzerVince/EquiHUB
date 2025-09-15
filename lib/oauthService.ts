import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';

export class OAuthService {
  private static instance: OAuthService;

  public static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }
    return OAuthService.instance;
  }

  /**
   * Initialize Google Sign-In configuration
   * 
   * IMPORTANT: You need to replace the webClientId with your actual Google OAuth 2.0 Web Client ID
   * Get it from: https://console.developers.google.com/
   * 1. Go to Google Cloud Console
   * 2. Select your project (or create one)
   * 3. Go to "Credentials" in the API & Services section
   * 4. Create OAuth 2.0 Client ID for Web application
   * 5. Copy the Client ID and replace the placeholder below
   */
  private async initializeGoogleSignIn() {
    try {
      await GoogleSignin.configure({
        webClientId: '645905000706-84poben7qoa735imq8ukp765ho5k0d97.apps.googleusercontent.com',
        offlineAccess: true,
        hostedDomain: '',
        forceCodeForRefreshToken: true,
      });
    } catch (error) {
      console.error('Google Sign-In configuration error:', error);
    }
  }

  /**
   * Sign in with Google OAuth using native modal
   */
  public async signInWithGoogle(): Promise<{
    user: any;
    session: any;
    error?: string;
  }> {
    try {
      // Initialize Google Sign-In if not already done
      await this.initializeGoogleSignIn();

      // Check if device supports Google Play Services
      await GoogleSignin.hasPlayServices();

      // Sign in with Google - this shows the native account picker modal
      const userInfo = await GoogleSignin.signIn();

      if (!userInfo.data?.idToken) {
        return { user: null, session: null, error: 'No ID token received from Google' };
      }

      // Sign in to Supabase using the Google ID token
      const { data, error } = await getSupabase().auth.signInWithIdToken({
        provider: 'google',
        token: userInfo.data.idToken,
      });

      if (error) {
        console.error('Supabase Google OAuth error:', error);
        return { user: null, session: null, error: error.message };
      }

      return {
        user: data.user,
        session: data.session,
      };
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { user: null, session: null, error: 'Google sign-in was cancelled' };
      } else if (error.code === statusCodes.IN_PROGRESS) {
        return { user: null, session: null, error: 'Google sign-in is already in progress' };
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { user: null, session: null, error: 'Google Play Services not available' };
      } else {
        return { user: null, session: null, error: 'Failed to sign in with Google' };
      }
    }
  }

  /**
   * Sign in with Apple OAuth
   */
  public async signInWithApple(): Promise<{
    user: any;
    session: any;
    error?: string;
  }> {
    try {
      if (Platform.OS !== 'ios') {
        return { user: null, session: null, error: 'Apple Sign In is only available on iOS' };
      }

      // Check if Apple Authentication is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return { user: null, session: null, error: 'Apple Sign In is not available on this device' };
      }

      // Generate a nonce for security
      const nonce = Math.random().toString(36).substring(2, 10);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );

      // Request Apple Authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      // Sign in with Supabase using the Apple credential
      const { data, error } = await getSupabase().auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
        nonce,
      });

      if (error) {
        console.error('Apple OAuth error:', error);
        return { user: null, session: null, error: error.message };
      }

      return {
        user: data.user,
        session: data.session,
      };
    } catch (error: any) {
      console.error('Apple sign-in error:', error);
      
      if (error.code === 'ERR_REQUEST_CANCELED') {
        return { user: null, session: null, error: 'Apple Sign In was cancelled' };
      }
      
      return { user: null, session: null, error: 'Failed to sign in with Apple' };
    }
  }

  /**
   * Sign out from current session
   */
  public async signOut(): Promise<{ error?: string }> {
    try {
      // Sign out from Supabase
      const { error } = await getSupabase().auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        return { error: error.message };
      }

      // Also sign out from Google Sign-In if user was signed in with Google
      try {
        await GoogleSignin.signOut();
      } catch (googleError) {
        console.warn('Google sign-out error:', googleError);
        // Don't fail the entire sign-out process if Google sign-out fails
      }

      return {};
    } catch (error) {
      console.error('Sign out error:', error);
      return { error: 'Failed to sign out' };
    }
  }

  /**
   * Get current session
   */
  public async getCurrentSession(): Promise<{
    session: any;
    user: any;
    error?: string;
  }> {
    try {
      const { data: { session }, error } = await getSupabase().auth.getSession();
      
      if (error) {
        console.error('Get session error:', error);
        return { session: null, user: null, error: error.message };
      }

      return {
        session,
        user: session?.user || null,
      };
    } catch (error) {
      console.error('Get session error:', error);
      return { session: null, user: null, error: 'Failed to get current session' };
    }
  }

  /**
   * Check if user is authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    try {
      const { session } = await this.getCurrentSession();
      return !!session;
    } catch (error) {
      console.error('Authentication check error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const oauthService = OAuthService.getInstance();
