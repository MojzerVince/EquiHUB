import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';

// Required for proper browser behavior
WebBrowser.maybeCompleteAuthSession();

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  provider: 'google' | 'apple' | 'facebook';
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  session?: any;
  error?: string;
}

export class OAuthService {
  private static instance: OAuthService;

  public static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }
    return OAuthService.instance;
  }

  /**
   * Google Sign-In (Available on both iOS and Android)
   * Uses Supabase's built-in OAuth with proper redirect handling
   */
  public async signInWithGoogle(): Promise<AuthResult> {
    try {
      const supabase = getSupabase();
      
      console.log('🔐 Starting Google OAuth with Supabase...');
      
      // Use the Supabase project URL as redirect - Supabase will handle the OAuth callback
      // and then we'll get the session from the URL
      const supabaseUrl = 'https://grdsqxwghajehneksxik.supabase.co';
      const redirectTo = `${supabaseUrl}/auth/v1/callback`;
      
      // For mobile apps, we also need to tell Supabase where to send users after OAuth
      // This is done via the redirect_to parameter
      const appRedirect = makeRedirectUri({
        scheme: 'equihub',
        path: ''
      });
      
      console.log('📍 OAuth redirect URI:', redirectTo);
      console.log('📍 App redirect URI:', appRedirect);
      
      // Initiate OAuth with Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          skipBrowserRedirect: true, // We'll handle the browser ourselves
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        console.error('❌ OAuth initiation error:', error);
        return { success: false, error: error.message };
      }

      if (!data?.url) {
        console.error('❌ No OAuth URL received');
        return { success: false, error: 'Failed to get OAuth URL' };
      }

      console.log('🌐 Opening browser for authentication...');

      // Open the OAuth URL in browser with app redirect as the return URL
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        appRedirect
      );

      console.log('📱 Browser result:', result.type);

      if (result.type === 'cancel') {
        console.log('❌ User cancelled');
        return { success: false, error: 'Google sign-in was cancelled' };
      }

      if (result.type !== 'success' || !result.url) {
        console.log('❌ Authentication failed');
        return { success: false, error: 'Authentication failed' };
      }

      console.log('✅ Got callback URL, extracting session...');
      console.log('🔍 Callback URL:', result.url);

      // Parse the URL to extract the tokens
      const url = new URL(result.url);
      const access_token = url.searchParams.get('access_token') || url.hash.split('access_token=')[1]?.split('&')[0];
      const refresh_token = url.searchParams.get('refresh_token') || url.hash.split('refresh_token=')[1]?.split('&')[0];

      if (!access_token) {
        console.error('❌ No access token in callback URL');
        return { success: false, error: 'No access token received' };
      }

      console.log('✅ Tokens extracted, setting session...');

      // Set the session with the tokens
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token: refresh_token || ''
      });

      if (sessionError) {
        console.error('❌ Session set error:', sessionError);
        return { success: false, error: sessionError.message };
      }

      if (!sessionData?.session?.user) {
        console.error('❌ No user in session');
        return { success: false, error: 'No user data received' };
      }

      const user = sessionData.session.user;
      console.log('✅ User authenticated:', user.email);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || 
                user.user_metadata?.full_name || 
                user.email?.split('@')[0] || 'User',
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
          provider: 'google'
        },
        session: sessionData.session
      };
    } catch (error: any) {
      console.error('❌ Google sign-in error:', error);
      return { success: false, error: error.message || 'Failed to sign in with Google' };
    }
  }

  /**
   * Apple Sign-In (iOS only)
   */
  public async signInWithApple(): Promise<AuthResult> {
    try {
      if (Platform.OS !== 'ios') {
        return { success: false, error: 'Apple Sign-In is only available on iOS' };
      }

      // Check if Apple Authentication is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Apple Sign-In is not available on this device' };
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

      if (!credential.identityToken) {
        return { success: false, error: 'No identity token received from Apple' };
      }

      // Sign in with Supabase using the Apple credential
      const { data, error } = await getSupabase().auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce,
      });

      if (error) {
        console.error('Apple OAuth error:', error);
        return { success: false, error: error.message };
      }

      if (data.user) {
        const user: AuthUser = {
          id: data.user.id,
          email: data.user.email || '',
          name: credential.fullName ? 
            `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() :
            data.user.user_metadata?.full_name || 'Apple User',
          avatar_url: data.user.user_metadata?.avatar_url,
          provider: 'apple'
        };

        return {
          success: true,
          user,
          session: data.session,
        };
      }

      return { success: false, error: 'No user data received from Apple' };
    } catch (error: any) {
      console.error('Apple sign-in error:', error);
      
      if (error.code === 'ERR_REQUEST_CANCELED') {
        return { success: false, error: 'Apple Sign-In was cancelled' };
      }
      
      return { success: false, error: 'Failed to sign in with Apple' };
    }
  }

  /**
   * Facebook Sign-In (Available on both platforms)
   */
  public async signInWithFacebook(): Promise<AuthResult> {
    try {
      const Facebook = require('expo-facebook');
      
      // Initialize Facebook SDK
      await Facebook.initializeAsync({
        appId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || 'YOUR_FACEBOOK_APP_ID', // Replace with your Facebook App ID
      });

      const result = await Facebook.logInWithReadPermissionsAsync({
        permissions: ['public_profile', 'email'],
      });

      if (result.type === 'success' && result.token) {
        // Get user info from Facebook
        const response = await fetch(`https://graph.facebook.com/me?access_token=${result.token}&fields=id,name,email,picture`);
        const userInfo = await response.json();

        // Save user to Supabase
        const authResult = await this.saveUserToSupabase({
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          avatar_url: userInfo.picture?.data?.url,
          provider: 'facebook'
        });

        return authResult;
      } else {
        return { success: false, error: result.type === 'cancel' ? 'Facebook sign-in was cancelled' : 'Facebook sign-in failed' };
      }
    } catch (error: any) {
      console.error('Facebook sign-in error:', error);
      
      if (error.message?.includes('appId')) {
        return { success: false, error: 'Facebook App ID not configured. Please set EXPO_PUBLIC_FACEBOOK_APP_ID.' };
      }
      
      return { success: false, error: 'Failed to sign in with Facebook' };
    }
  }

  /**
   * Save user to Supabase database
   */
  private async saveUserToSupabase(user: AuthUser): Promise<AuthResult> {
    try {
      const supabase = getSupabase();
      
      // Instead of manually managing users, use Supabase Auth's built-in OAuth
      // For now, we'll just return the user data since auth is handled by Supabase
      console.log('User authenticated via OAuth:', user.email);

      // Create or update user profile in the profiles table
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('google_id', user.id)
        .single();

      let profileData;

      if (existingProfile) {
        // Update existing profile
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({
            name: user.name,
            profile_image_url: user.avatar_url,
            updated_at: new Date().toISOString(),
          })
          .eq('google_id', user.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating profile:', updateError);
        } else {
          profileData = updatedProfile;
        }
      } else {
        // For new users, we'll need to create a profile during registration flow
        // This is just for existing users
        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error checking profile:', fetchError);
        }
      }

      return {
        success: true,
        user: {
          id: profileData?.id || user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          provider: user.provider,
        },
      };
    } catch (error: any) {
      console.error('Profile update error:', error);
      return { 
        success: true, // Don't fail auth if profile update fails
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          provider: user.provider,
        },
      };
    }
  }

  /**
   * Sign out from all providers
   */
  public async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      // Sign out from Supabase
      const { error } = await getSupabase().auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
      }

      // Clear any cached auth data
      // You might want to clear AsyncStorage or other cached data here

      return { success: true };
    } catch (error: any) {
      console.error('Sign out error:', error);
      return { success: false, error: 'Failed to sign out' };
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
    } catch (error: any) {
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