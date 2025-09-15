import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';

// Complete the auth session for web browser
WebBrowser.maybeCompleteAuthSession();

export class OAuthService {
  private static instance: OAuthService;

  public static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }
    return OAuthService.instance;
  }

  /**
   * Sign in with Google OAuth
   */
  public async signInWithGoogle(): Promise<{
    user: any;
    session: any;
    error?: string;
  }> {
    try {
      // Use Supabase's built-in OAuth with redirect URL
      const redirectUrl = AuthSession.makeRedirectUri();

      const { data, error } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);
        return { user: null, session: null, error: error.message };
      }

      // Open the OAuth URL in browser
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          // Parse the URL to get the session
          const url = new URL(result.url);
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');

          if (accessToken) {
            // Set the session in Supabase
            const { data: sessionData, error: sessionError } = await getSupabase().auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (sessionError) {
              console.error('Session error:', sessionError);
              return { user: null, session: null, error: sessionError.message };
            }

            return {
              user: sessionData.user,
              session: sessionData.session,
            };
          }
        }
      }

      return { user: null, session: null, error: 'OAuth cancelled or failed' };
    } catch (error) {
      console.error('Google sign-in error:', error);
      return { user: null, session: null, error: 'Failed to sign in with Google' };
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
      const { error } = await getSupabase().auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        return { error: error.message };
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
