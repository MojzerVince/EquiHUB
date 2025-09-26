import { SessionManager } from './sessionManager';
import { getSupabase } from './supabase';

export interface GoogleAuthResult {
  user: any | null;
  error: string | null;
  isNewUser?: boolean;
}

/**
 * Google Authentication Service that works like email registration
 * Users are created in Supabase Auth (auth.users) just like email signups
 */
export class GoogleAuthService {
  
  /**
   * Complete Google registration - creates user in Supabase Auth like email registration
   * This method should be called after user provides profile data
   */
  static async completeGoogleRegistration(
    googleUserInfo: {
      id: string;
      email: string;
      name: string;
      picture?: string;
    },
    profileData: {
      name: string;
      age: number;
      description?: string;
      riding_experience?: number;
      stable_id?: string;
    }
  ): Promise<GoogleAuthResult> {
    try {
      console.log('Completing Google registration for:', googleUserInfo.email);
      
      // Validate profile data
      if (!profileData.name || !profileData.age) {
        return { user: null, error: 'Name and age are required' };
      }

      if (profileData.age < 13 || profileData.age > 120) {
        return { user: null, error: 'Age must be between 13 and 120' };
      }

      if (profileData.riding_experience !== undefined && (profileData.riding_experience < 0 || profileData.riding_experience > 80)) {
        return { user: null, error: 'Riding experience must be between 0 and 80 years' };
      }

      const supabase = getSupabase();

      // Check if user already exists in Supabase Auth
      // We can't directly query auth.users, so we'll try to create and handle the error
      
      // Create user in Supabase Auth - same as email registration
      // Generate a secure random password since this is OAuth
      const tempPassword = Array.from({ length: 24 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
          .charAt(Math.floor(Math.random() * 69))
      ).join('');
      
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: googleUserInfo.email,
        password: tempPassword,
        options: {
          data: {
            // Store all the profile data in user_metadata like email registration
            name: profileData.name,
            age: profileData.age,
            description: profileData.description || 'Equestrian enthusiast',
            riding_experience: profileData.riding_experience || 0,
            stable_id: profileData.stable_id || null,
            // Store Google-specific data
            google_id: googleUserInfo.id,
            avatar_url: googleUserInfo.picture,
            auth_provider: 'google',
            full_name: googleUserInfo.name
          }
        }
      });

      if (signUpError) {
        console.error('Google registration error:', signUpError);
        if (signUpError.message.includes('already registered') || signUpError.message.includes('User already registered')) {
          // User exists, try to sign them in instead
          return await this.signInExistingGoogleUser(googleUserInfo);
        }
        return { user: null, error: signUpError.message };
      }

      if (!authData.user) {
        return { user: null, error: 'Failed to create user account' };
      }

      // Create profile in profiles table (same as you do for email users)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          name: profileData.name,
          age: profileData.age,
          description: profileData.description || '',
          experience: profileData.riding_experience || 0,
          profile_image_url: googleUserInfo.picture,
          google_id: googleUserInfo.id,
          auth_provider: 'google',
          is_pro_member: false,
          stable_id: profileData.stable_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (profileError && profileError.code !== '23505') {
        console.error('Error creating profile:', profileError);
        // Don't fail registration if profile creation fails
      }

      // Store last login time for session tracking
      await SessionManager.storeLastLoginTime();

      console.log('Google registration successful:', authData.user.id);

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          name: profileData.name,
          avatar_url: googleUserInfo.picture,
          created_at: authData.user.created_at!,
          provider: 'google'
        },
        error: null,
        isNewUser: true
      };

    } catch (error) {
      console.error('Google registration error:', error);
      return { user: null, error: 'Google registration failed' };
    }
  }

  /**
   * Sign in existing Google user (when they already have an account)
   */
  static async signInExistingGoogleUser(googleUserInfo: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  }): Promise<GoogleAuthResult> {
    try {
      console.log('Signing in existing Google user:', googleUserInfo.email);
      
      // For existing users, we need to use a different approach since we can't 
      // directly sign them into Supabase Auth with just Google info
      
      // Option 1: Use Supabase's password reset to let them set a password
      // Option 2: Use a magic link
      // Option 3: Store their Google ID and match against profiles table
      
      // Let's use magic link approach for existing Google users
      const supabase = getSupabase();
      
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: googleUserInfo.email,
        options: {
          data: {
            google_id: googleUserInfo.id,
            auth_provider: 'google'
          }
        }
      });

      if (magicLinkError) {
        console.error('Magic link error:', magicLinkError);
        return { 
          user: null, 
          error: 'User exists but sign-in failed. Please try signing in with email/password or reset your password.' 
        };
      }

      return {
        user: null,
        error: 'MAGIC_LINK_SENT', // Special error code to indicate magic link was sent
        isNewUser: false
      };

    } catch (error) {
      console.error('Existing Google user sign-in error:', error);
      return { user: null, error: 'Sign-in failed for existing user' };
    }
  }

  /**
   * Check if Google user already exists (for UI flow decisions)
   */
  static async checkGoogleUserExists(email: string): Promise<{ exists: boolean; error: string | null }> {
    try {
      // Try to send a password reset email
      // If successful, user exists. If it fails, user might not exist.
      const supabase = getSupabase();
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://example.com/dummy' // Dummy redirect
      });

      // No error usually means user exists
      return { exists: !error, error: null };
      
    } catch (error) {
      console.error('Check user exists error:', error);
      return { exists: false, error: 'Failed to check if user exists' };
    }
  }
}