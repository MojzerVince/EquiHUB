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
      
      // For Google OAuth, check if user exists by google_id
      console.log("🔍 OAuth: Checking for existing user with provider ID:", user.id, "and provider:", user.provider);
      
      let existingUser = null;
      let fetchError = null;

      if (user.provider === 'google') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('google_id', user.id)
          .single();
        existingUser = data;
        fetchError = error;
      } else if (user.provider === 'apple') {
        // For future Apple OAuth support
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('apple_id', user.id)
          .single();
        existingUser = data;
        fetchError = error;
      } else if (user.provider === 'facebook') {
        // For future Facebook OAuth support
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('facebook_id', user.id)
          .single();
        existingUser = data;
        fetchError = error;
      }

      console.log("🔍 OAuth: Query result:", { existingUser, fetchError });

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ OAuth: Error fetching user from profiles table:', fetchError);
        console.error('❌ OAuth: Error details:', {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          table: 'profiles',
          query: `SELECT * FROM profiles WHERE ${user.provider}_id = ?`,
          provider: user.provider,
          providerId: user.id
        });
        return { success: false, error: `Failed to check existing user: ${fetchError.message}` };
      }

      let userData;

      if (existingUser) {
        // Update existing user
        console.log("✅ OAuth: Existing user found, updating profile");
        const { data: updatedUser, error: updateError } = await supabase
          .from('profiles')
          .update({
            name: user.name,
            profile_image_url: user.avatar_url,
            social_picture_url: user.avatar_url,
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ OAuth: Error updating user:', updateError);
          console.error('❌ OAuth: Update error details:', {
            code: updateError.code,
            message: updateError.message,
            details: updateError.details
          });
          return { success: false, error: `Failed to update user profile: ${updateError.message}` };
        }

        userData = updatedUser;
        console.log("✅ OAuth: User profile updated successfully");
      } else {
        // Create new user
        console.log("🆕 OAuth: Creating new user profile");
        
        // NOTE: This is a simplified approach. Ideally, we should use Supabase's built-in OAuth
        // and create the profile after successful authentication with the auth user's ID.
        
        const { data: newUser, error: insertError } = await supabase
          .from('profiles')
          .insert({
            // id will be auto-generated by uuid_generate_v4() - this needs to match auth.users.id eventually
            name: user.name || 'User', // Required field
            age: 25, // Required field - default age, user can update later
            description: '', // Optional field
            profile_image_url: user.avatar_url, // Using correct column name
            auth_provider: user.provider,
            google_id: user.provider === 'google' ? user.id : null,
            social_provider_id: user.id, // Store the provider ID
            social_picture_url: user.avatar_url, // Store the social picture URL
            experience: 0 // Default experience
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ OAuth: Error creating user:', insertError);
          console.error('❌ OAuth: Insert error details:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details
          });
          return { success: false, error: `Failed to create user profile: ${insertError.message}` };
        }

        userData = newUser;
        console.log("✅ OAuth: New user created successfully");
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
      console.error('❌ OAuth: Supabase save error:', error);
      console.error('❌ OAuth: Error stack:', error.stack);
      return { success: false, error: `Failed to save user data: ${error.message || 'Unknown error'}` };
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