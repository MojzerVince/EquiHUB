import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { useGoogleAuth } from './googleAuth';
import { getSupabase } from './supabase';

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
   */
  public async signInWithGoogle(): Promise<AuthResult> {
    try {
      const { promptAsync } = useGoogleAuth();
      const result = await promptAsync() as any;

      if (result?.type === 'success' && result?.user) {
        // Save user to Supabase
        const authResult = await this.saveUserToSupabase({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          avatar_url: result.user.picture,
          provider: 'google'
        });

        return authResult;
      } else if (result?.type === 'cancelled') {
        return { success: false, error: 'Google sign-in was cancelled' };
      } else {
        return { success: false, error: result?.error || 'Google sign-in failed' };
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      return { success: false, error: 'Failed to sign in with Google' };
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
      
      // First, check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user:', fetchError);
        return { success: false, error: 'Failed to check existing user' };
      }

      let userData;

      if (existingUser) {
        // Update existing user
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            name: user.name,
            avatar_url: user.avatar_url,
            last_sign_in_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating user:', updateError);
          return { success: false, error: 'Failed to update user profile' };
        }

        userData = updatedUser;
      } else {
        // Create new user
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            name: user.name,
            avatar_url: user.avatar_url,
            provider: user.provider,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating user:', insertError);
          return { success: false, error: 'Failed to create user profile' };
        }

        userData = newUser;
      }

      return {
        success: true,
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          avatar_url: userData.avatar_url,
          provider: userData.provider,
        },
      };
    } catch (error: any) {
      console.error('Supabase save error:', error);
      return { success: false, error: 'Failed to save user data' };
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