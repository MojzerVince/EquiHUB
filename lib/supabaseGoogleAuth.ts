import { Platform } from 'react-native';
import { SessionManager } from './sessionManager';
import { getSupabase } from './supabase';

/**
 * Simple Google OAuth implementation using Supabase's built-in OAuth
 * This avoids the need for custom user table management
 */
export class SupabaseGoogleAuth {
  /**
   * Sign in with Google using Supabase's OAuth provider
   */
  static async signInWithGoogle(): Promise<{ user: any | null; error: string | null }> {
    try {
      console.log('Starting Google OAuth with Supabase...');
      const supabase = getSupabase();

      if (Platform.OS === 'web') {
        // For web, use Supabase's signInWithOAuth
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          console.error('Google OAuth error:', error);
          return { user: null, error: error.message };
        }

        return { user: null, error: null }; // OAuth redirect will handle the rest
      } else {
        // For mobile, we need to use deep linking with Supabase OAuth
        const redirectUrl = 'com.mojzi1969.EquiHUB://oauth/callback';
        
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        });

        if (error) {
          console.error('Google OAuth error:', error);
          return { user: null, error: error.message };
        }

        // The auth URL will be opened in browser, and callback handled by deep linking
        if (data.url) {
          const WebBrowser = require('expo-web-browser');
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
          
          if (result.type === 'success') {
            // Get the session after successful OAuth
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
              return { user: null, error: sessionError.message };
            }

            if (session?.user) {
              await SessionManager.storeLastLoginTime();
              
              return {
                user: {
                  id: session.user.id,
                  email: session.user.email,
                  name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
                  avatar_url: session.user.user_metadata?.avatar_url,
                  provider: 'google',
                  created_at: session.user.created_at,
                },
                error: null
              };
            }
          } else if (result.type === 'cancel') {
            return { user: null, error: 'Google sign-in was cancelled' };
          }
        }

        return { user: null, error: 'Google authentication failed' };
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      return { user: null, error: error.message || 'Google sign-in failed' };
    }
  }

  /**
   * Handle OAuth callback (for deep linking)
   */
  static async handleOAuthCallback(url: string): Promise<{ user: any | null; error: string | null }> {
    try {
      console.log('Handling OAuth callback:', url);
      const supabase = getSupabase();

      // Extract tokens from the callback URL
      const { data, error } = await supabase.auth.getSessionFromUrl();

      if (error) {
        console.error('OAuth callback error:', error);
        return { user: null, error: error.message };
      }

      if (data.session?.user) {
        await SessionManager.storeLastLoginTime();
        
        // Check if this is a new user (you can add profile creation logic here)
        const isNewUser = data.session.user.created_at === data.session.user.last_sign_in_at;
        
        if (isNewUser) {
          // Create profile in profiles table if needed
          await this.createUserProfile(data.session.user);
        }

        return {
          user: {
            id: data.session.user.id,
            email: data.session.user.email,
            name: data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name,
            avatar_url: data.session.user.user_metadata?.avatar_url,
            provider: 'google',
            created_at: data.session.user.created_at,
            isNewUser,
          },
          error: null
        };
      }

      return { user: null, error: 'No user data in callback' };
    } catch (error: any) {
      console.error('OAuth callback handling error:', error);
      return { user: null, error: error.message || 'OAuth callback failed' };
    }
  }

  /**
   * Create user profile in the profiles table for new users
   */
  private static async createUserProfile(authUser: any): Promise<void> {
    try {
      const supabase = getSupabase();
      
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'Google User',
          profile_image_url: authUser.user_metadata?.avatar_url,
          google_id: authUser.user_metadata?.provider_id || authUser.id,
          auth_provider: 'google',
          age: null, // Will be filled during profile setup
          description: '',
          experience: 0,
          is_pro_member: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        console.error('Error creating user profile:', error);
      } else {
        console.log('User profile created successfully');
      }
    } catch (error) {
      console.error('Profile creation error:', error);
    }
  }

  /**
   * Get current authenticated user
   */
  static async getCurrentUser(): Promise<{ user: any | null; error: string | null }> {
    try {
      const supabase = getSupabase();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        return { user: null, error: error.message };
      }

      if (session?.user) {
        return {
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            avatar_url: session.user.user_metadata?.avatar_url,
            provider: session.user.app_metadata?.provider,
            created_at: session.user.created_at,
          },
          error: null
        };
      }

      return { user: null, error: null };
    } catch (error: any) {
      return { user: null, error: error.message || 'Failed to get current user' };
    }
  }

  /**
   * Sign out
   */
  static async signOut(): Promise<{ error: string | null }> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'Sign out failed' };
    }
  }
}