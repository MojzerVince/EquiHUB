import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { AuthUser } from './authAPI';
import { oauthConfig } from './oauthConfig';
import { SessionManager } from './sessionManager';
import { getSupabase } from './supabase';

export interface OAuthProvider {
  id: 'google' | 'apple';
  name: string;
  color: string;
  icon: string;
}

export const oauthProviders: OAuthProvider[] = [
  {
    id: 'google',
    name: 'Google',
    color: '#4285F4',
    icon: '🔍', // You can replace with proper icon components
  },
  {
    id: 'apple',
    name: 'Apple',
    color: '#000000',
    icon: '🍎', // You can replace with proper icon components
  },
];

export class OAuthService {
  
  // Configure Google Sign-In
  static async configureGoogleSignIn() {
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({
        webClientId: oauthConfig.google.webClientId,
        iosClientId: oauthConfig.google.iosClientId,
        offlineAccess: true,
        hostedDomain: '',
        forceCodeForRefreshToken: true,
      });
    } catch (error) {
      console.log('Google Sign-In not available in this environment');
      throw error;
    }
  }

  // Check if Apple Sign In is available (iOS 13+)
  static async isAppleSignInAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    try {
      const AppleAuthentication = await import('expo-apple-authentication');
      return await AppleAuthentication.isAvailableAsync();
    } catch {
      return false;
    }
  }

  // Sign in with Google (Native Modal - Production Only)
  static async signInWithGoogle(): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      console.log('🔵 Starting Native Google Sign In...');
      
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      
      // Configure Google Sign-In if not already configured
      await this.configureGoogleSignIn();
      
      // Check if device has Google Play Services (Android)
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }
      
      // Show the native Google account selection modal
      const userInfo = await GoogleSignin.signIn();
      console.log('📱 Google user info received:', userInfo.data?.user?.email);

      if (!userInfo.data?.idToken) {
        return { user: null, error: 'No ID token received from Google' };
      }

      // Sign in to Supabase using the Google ID token
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: userInfo.data.idToken,
      });

      if (error) {
        console.error('❌ Supabase Google OAuth error:', error);
        return { user: null, error: `Authentication failed: ${error.message}` };
      }

      if (!data.user) {
        return { user: null, error: 'Failed to authenticate with Google' };
      }

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email!,
        created_at: data.user.created_at!,
      };

      // Store last login time
      await SessionManager.storeLastLoginTime();
      await SessionManager.markUserAsUsedApp();

      console.log('✅ Native Google Sign In successful:', authUser.email);
      return { user: authUser, error: null };

    } catch (error: any) {
      console.error('❌ Native Google Sign In error:', error);
      
      // Handle specific Google Sign-In errors
      if (error.code === 'SIGN_IN_CANCELLED') {
        return { user: null, error: 'Sign in was cancelled' };
      } else if (error.code === 'IN_PROGRESS') {
        return { user: null, error: 'Another sign in is already in progress' };
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        return { user: null, error: 'Google Play Services is not available on this device' };
      }
      
      return { user: null, error: 'An unexpected error occurred with Google Sign In' };
    }
  }

  // Sign in with Apple
  static async signInWithApple(): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      console.log('🍎 Starting Apple Sign In...');

      // Check if Apple Sign In is available
      const isAvailable = await this.isAppleSignInAvailable();
      if (!isAvailable) {
        return { user: null, error: 'Apple Sign In is not available on this device' };
      }

      // Create nonce for security
      const nonce = Math.random().toString(36).substring(2, 15);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );

      // Request Apple authentication
      const AppleAuthentication = await import('expo-apple-authentication');
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      console.log('📱 Apple credential received');

      if (!appleCredential.identityToken) {
        return { user: null, error: 'No identity token received from Apple' };
      }

      // Sign in with Supabase using Apple identity token
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: appleCredential.identityToken,
        nonce,
      });

      if (error) {
        console.error('❌ Apple OAuth error:', error);
        return { user: null, error: error.message };
      }

      if (!data.user) {
        return { user: null, error: 'Failed to authenticate with Apple' };
      }

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email!,
        created_at: data.user.created_at!,
      };

      // Store last login time
      await SessionManager.storeLastLoginTime();
      await SessionManager.markUserAsUsedApp();

      console.log('✅ Apple Sign In successful:', authUser.email);
      return { user: authUser, error: null };

    } catch (error: any) {
      console.error('❌ Apple Sign In error:', error);
      
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        return { user: null, error: 'Sign in was cancelled' };
      }
      
      return { user: null, error: 'An unexpected error occurred with Apple Sign In' };
    }
  }

  // Register with OAuth (same as sign in, but for new users)
  static async registerWithGoogle(): Promise<{ user: AuthUser | null; error: string | null }> {
    // For OAuth, registration is the same as sign in
    // Supabase will create a new user if they don't exist
    return this.signInWithGoogle();
  }

  static async registerWithApple(): Promise<{ user: AuthUser | null; error: string | null }> {
    // For OAuth, registration is the same as sign in
    // Supabase will create a new user if they don't exist
    return this.signInWithApple();
  }

  // Get available OAuth providers for current platform
  static getAvailableProviders(): OAuthProvider[] {
    const providers: OAuthProvider[] = [];
    
    // Google is available on all platforms
    providers.push(oauthProviders.find(p => p.id === 'google')!);
    
    // Apple is only available on iOS
    if (Platform.OS === 'ios') {
      providers.push(oauthProviders.find(p => p.id === 'apple')!);
    }
    
    return providers;
  }

  // Sign out (works for all auth methods)
  static async signOut(): Promise<{ error: string | null }> {
    try {
      // Sign out from Google if signed in
      try {
        const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
        console.log('✅ Google sign-out successful');
      } catch (googleError) {
        // Ignore Google sign-out errors as user might not be signed in via Google
        console.log('Google sign-out skipped:', googleError);
      }

      const supabase = getSupabase();
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ OAuth sign out error:', error);
        return { error: error.message };
      }

      // Clear session data
      await SessionManager.clearSessionData();
      
      console.log('✅ OAuth sign out successful');
      return { error: null };
      
    } catch (error) {
      console.error('❌ OAuth sign out error:', error);
      return { error: 'An unexpected error occurred during sign out' };
    }
  }
}
