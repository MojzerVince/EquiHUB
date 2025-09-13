import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { AuthUser } from './authAPI';
import { SessionManager } from './sessionManager';
import { getSupabase } from './supabase';

// Complete the WebBrowser auth session when returning to app
WebBrowser.maybeCompleteAuthSession();

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
  
  // Check if Apple Sign In is available (iOS 13+)
  static async isAppleSignInAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    try {
      return await AppleAuthentication.isAvailableAsync();
    } catch {
      return false;
    }
  }

  // Sign in with Google
  static async signInWithGoogle(): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      console.log('🔵 Starting Google Sign In...');
      
      const supabase = getSupabase();
      
      // Create auth request
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'equihub',
        path: 'auth/callback',
      });

      console.log('📱 Redirect URI:', redirectUri);

      // Start Google OAuth flow through Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        
        // Provide specific error messages for common issues
        if (error.message.includes('provider is not enabled')) {
          return { 
            user: null, 
            error: 'Google Sign-In is not enabled in Supabase. Please enable it in Authentication → Providers in your Supabase dashboard.' 
          };
        } else if (error.message.includes('invalid_client')) {
          return { 
            user: null, 
            error: 'Google OAuth client configuration is invalid. Please check your Google Cloud Console setup.' 
          };
        }
        
        return { user: null, error: `Google Sign-In error: ${error.message}` };
      }

      if (!data.url) {
        return { user: null, error: 'Failed to get OAuth URL' };
      }

      console.log('🌐 Opening OAuth URL...');
      
      // Open the OAuth URL in browser
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri,
        {
          showInRecents: true,
        }
      );

      console.log('📱 OAuth result:', result);

      if (result.type === 'success') {
        // Parse the URL to get the session info
        const url = result.url;
        const parsedUrl = new URL(url);
        
        // Check for error in callback
        const error = parsedUrl.searchParams.get('error');
        if (error) {
          return { user: null, error: `OAuth error: ${error}` };
        }

        // Get the session after successful OAuth
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session.session?.user) {
          console.error('❌ Session error after OAuth:', sessionError);
          return { user: null, error: 'Failed to get session after OAuth' };
        }

        const authUser: AuthUser = {
          id: session.session.user.id,
          email: session.session.user.email!,
          created_at: session.session.user.created_at!,
        };

        // Store last login time
        await SessionManager.storeLastLoginTime();
        await SessionManager.markUserAsUsedApp();

        console.log('✅ Google Sign In successful:', authUser.email);
        return { user: authUser, error: null };
      } else if (result.type === 'cancel') {
        return { user: null, error: 'Sign in was cancelled' };
      } else {
        return { user: null, error: 'Sign in failed' };
      }

    } catch (error) {
      console.error('❌ Google Sign In error:', error);
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

  // Handle deep link callback (for Google OAuth)
  static handleAuthCallback(url: string): boolean {
    try {
      console.log('📱 Handling auth callback URL:', url);
      
      // Check if this is an auth callback
      if (url.includes('auth/callback')) {
        // The WebBrowser session will handle this automatically
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error handling auth callback:', error);
      return false;
    }
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
