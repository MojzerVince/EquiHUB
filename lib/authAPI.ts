import { Platform } from 'react-native';
import { SessionManager } from './sessionManager';
import { getSupabase } from './supabase';

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  age: number;
  description?: string;
  riding_experience?: number;
  stable_id?: string; // Optional stable to join during registration
  stable_join_code?: string; // Optional join code for stable
}

export interface LoginData {
  email: string;
  password: string;
}

export class AuthAPI {
  // Register a new user
  static async register(data: RegisterData): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      console.log('Registering user:', data.email);

      // Validate input
      if (!data.email || !data.password || !data.name || !data.age) {
        return { user: null, error: 'All fields are required' };
      }

      if (data.password.length < 6) {
        return { user: null, error: 'Password must be at least 6 characters long' };
      }

      if (data.age < 13 || data.age > 120) {
        return { user: null, error: 'Age must be between 13 and 120' };
      }

      if (data.riding_experience !== undefined && (data.riding_experience < 0 || data.riding_experience > 80)) {
        return { user: null, error: 'Riding experience must be between 0 and 80 years' };
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return { user: null, error: 'Please enter a valid email address' };
      }

      // Name validation
      const namePattern = /^[\p{L}\p{M}\s\-'\.]+$/u;
      if (!namePattern.test(data.name) || data.name.length < 2 || data.name.length > 50) {
        return { user: null, error: 'Name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes' };
      }

      // Register the user with Supabase Auth and include metadata for the trigger
      // Create Supabase user account
      const supabase = getSupabase();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name.trim(),
            age: data.age,
            description: data.description?.trim() || 'Equestrian enthusiast',
            riding_experience: data.riding_experience || 0,
            stable_id: data.stable_id || null,
            stable_join_code: data.stable_join_code || null
          }
        }
      });

      if (authError) {
        console.error('Auth registration error:', authError);
        return { user: null, error: authError.message };
      }

      if (!authData.user) {
        return { user: null, error: 'Registration failed. Please try again.' };
      }

      console.log('User registered successfully:', authData.user.id);

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          created_at: authData.user.created_at!
        },
        error: null
      };

    } catch (error) {
      console.error('Registration error:', error);
      return { user: null, error: 'An unexpected error occurred. Please try again.' };
    }
  }

  // Login user
  static async login(data: LoginData): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      console.log('Logging in user:', data.email);

      // Validate input
      if (!data.email || !data.password) {
        return { user: null, error: 'Email and password are required' };
      }

      const supabase = getSupabase();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        console.error('Login error:', authError);
        return { user: null, error: authError.message };
      }

      if (!authData.user) {
        return { user: null, error: 'Login failed. Please try again.' };
      }

      // Store last login time for session tracking
      await SessionManager.storeLastLoginTime();

      console.log('User logged in successfully:', authData.user.id);

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          created_at: authData.user.created_at!
        },
        error: null
      };

    } catch (error) {
      console.error('Login error:', error);
      return { user: null, error: 'An unexpected error occurred. Please try again.' };
    }
  }

  // Logout user
  static async logout(): Promise<{ error: string | null }> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Logout error:', error);
        return { error: error.message };
      }

      console.log('User logged out successfully');
      return { error: null };

    } catch (error) {
      console.error('Logout error:', error);
      return { error: 'An unexpected error occurred during logout.' };
    }
  }

  // Get current user session via REST API (avoiding supabase.auth.getSession() timeouts)
  static async getCurrentUser(): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const AsyncStorage = await import('@react-native-async-storage/async-storage').then(
        module => module.default
      );

      // Get secure configuration
      const { secureConfig } = await import('./secureConfig');
      const config = secureConfig.getSupabaseConfig();
      
      if (!config.url || !config.anonKey) {
        console.log('❌ Supabase configuration not available');
        return { user: null, error: 'Configuration not loaded' };
      }

      // Try to get session from AsyncStorage - check multiple possible keys
      let sessionData: string | null = null;
      let accessToken: string | null = null;

      // Common Supabase session storage keys
      const possibleKeys = [
        'supabase.auth.token',
        `sb-${config.url.split('//')[1].split('.')[0]}-auth-token`,
        'sb-grdsqxwghajehneksxik-auth-token', // Specific to this project
        '@supabase/auth-js:session',
        // Add additional patterns that might be used
        `supabase.auth.token.${config.url.split('//')[1].split('.')[0]}`,
        'supabase-auth-token',
      ];

      console.log('🔍 Checking for stored session tokens...');
      
      // First, let's see what keys are actually stored
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const authRelatedKeys = allKeys.filter(key => 
          key.includes('supabase') || 
          key.includes('auth') || 
          key.includes('sb-') ||
          key.includes('session')
        );
        console.log('📱 All auth-related keys in storage:', authRelatedKeys);
      } catch (e) {
        console.log('❌ Could not enumerate AsyncStorage keys');
      }
      
      // Try each possible key
      for (const key of possibleKeys) {
        try {
          sessionData = await AsyncStorage.getItem(key);
          if (sessionData) {
            console.log(`📱 Found session data with key: ${key}`);
            const session = JSON.parse(sessionData);
            accessToken = session?.access_token;
            if (accessToken) {
              console.log('✅ Found valid access token');
              break;
            }
          }
        } catch (e) {
          console.log(`🔍 Key ${key} not valid JSON or accessible`);
        }
      }

      // If no session found in known keys, search all keys
      if (!accessToken) {
        console.log('🔍 Searching all AsyncStorage keys for Supabase session...');
        try {
          const allKeys = await AsyncStorage.getAllKeys();
          const authKeys = allKeys.filter(key => 
            key.includes('supabase') || 
            key.includes('auth') || 
            key.includes('sb-') ||
            key.includes('session')
          );
          
          console.log('📋 Found auth-related keys:', authKeys);
          
          for (const key of authKeys) {
            try {
              const data = await AsyncStorage.getItem(key);
              if (data) {
                const parsed = JSON.parse(data);
                
                // Check various possible token locations in the session data
                const possibleTokenPaths = [
                  parsed.access_token,
                  parsed?.session?.access_token,
                  parsed?.data?.session?.access_token,
                  parsed?.user?.session?.access_token,
                ];
                
                for (const token of possibleTokenPaths) {
                  if (token && typeof token === 'string') {
                    accessToken = token;
                    console.log(`✅ Found access token in key: ${key}`);
                    break;
                  }
                }
                
                if (accessToken) break;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        } catch (e) {
          console.log('❌ Failed to scan AsyncStorage keys:', e);
        }
      }
      
      if (!accessToken) {
        console.log('❌ No stored session data available');
        return { user: null, error: null };
      }

      // Verify token by making a simple REST API call to auth.users endpoint
      console.log('🔐 Verifying access token with Supabase...');
      const response = await fetch(`${config.url}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('🔑 Token expired or invalid - attempting session refresh');
          
          // Try to refresh the session using the Supabase client
          try {
            const { getSupabase } = await import('./supabase');
            const supabase = getSupabase();
            const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
            
            if (session && session.user && !refreshError) {
              console.log('✅ Session refreshed successfully');
              return {
                user: {
                  id: session.user.id,
                  email: session.user.email!,
                  created_at: session.user.created_at!
                },
                error: null
              };
            } else {
              console.log('❌ Session refresh failed');
            }
          } catch (refreshError) {
            console.log('❌ Error during session refresh:', refreshError);
          }
          
          // Clear invalid session from all possible keys
          for (const key of possibleKeys) {
            await AsyncStorage.removeItem(key);
          }
          return { user: null, error: null };
        }
        const errorText = await response.text();
        console.error(`🚨 Auth API Error (${response.status}):`, errorText);
        return { user: null, error: `Authentication failed: ${response.status}` };
      }

      const userData = await response.json();
      
      if (!userData || !userData.id) {
        console.log('❌ No user data in response');
        return { user: null, error: null };
      }

      console.log('✅ Successfully verified user via REST API:', userData.email);
      return {
        user: {
          id: userData.id,
          email: userData.email,
          created_at: userData.created_at
        },
        error: null
      };

    } catch (error) {
      console.error('Get current user via REST API error:', error);
      return { user: null, error: 'Failed to get current user via REST API.' };
    }
  }

  // Reset password
  static async resetPassword(email: string): Promise<{ error: string | null }> {
    try {
      if (!email) {
        return { error: 'Email is required' };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { error: 'Please enter a valid email address' };
      }

      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        console.error('Password reset error:', error);
        return { error: error.message };
      }

      console.log('Password reset email sent successfully');
      return { error: null };

    } catch (error) {
      console.error('Password reset error:', error);
      return { error: 'Failed to send password reset email.' };
    }
  }

  // Update password
  static async updatePassword(newPassword: string): Promise<{ error: string | null }> {
    try {
      if (!newPassword) {
        return { error: 'New password is required' };
      }

      if (newPassword.length < 6) {
        return { error: 'Password must be at least 6 characters long' };
      }

      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        return { error: error.message };
      }

      console.log('Password updated successfully');
      return { error: null };

    } catch (error) {
      console.error('Password update error:', error);
      return { error: 'Failed to update password.' };
    }
  }

  // Check if user exists by email
  static async checkUserExists(email: string): Promise<{ exists: boolean; error: string | null }> {
    try {
      // This is a workaround since Supabase doesn't provide a direct way to check if user exists
      // We'll attempt to send a password reset which will succeed if user exists
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://example.com/dummy' // Dummy redirect
      });

      // If no error, user likely exists (or we can't tell)
      // If error, user might not exist (but could be other errors)
      return { exists: !error, error: null };

    } catch (error) {
      console.error('Check user exists error:', error);
      return { exists: false, error: 'Failed to check if user exists.' };
    }
  }

  // Delete user account permanently
  static async deleteAccount(): Promise<{ success: boolean; error: string | null }> {
    try {
      console.log('Starting account deletion process...');

      const supabase = getSupabase();
      
      // Get current user first
      const { data: { user }, error: getUserError } = await supabase.auth.getUser();
      
      if (getUserError || !user) {
        console.error('Error getting user for deletion:', getUserError);
        return { success: false, error: 'User not found or not authenticated.' };
      }

      const userId = user.id;
      console.log('Deleting account for user:', userId);

      // First, delete all user-related data from the database
      // This includes profile, horses, posts, sessions, etc.
      
      // Delete user's posts
      const { error: postsError } = await supabase
        .from('community_posts')
        .delete()
        .eq('user_id', userId);

      if (postsError) {
        console.error('Error deleting user posts:', postsError);
        // Continue anyway, we'll try to delete other data
      }

      // Delete user's horses
      const { error: horsesError } = await supabase
        .from('horses')
        .delete()
        .eq('user_id', userId);

      if (horsesError) {
        console.error('Error deleting user horses:', horsesError);
        // Continue anyway
      }

      // Delete user's sessions
      const { error: sessionsError } = await supabase
        .from('training_sessions')
        .delete()
        .eq('user_id', userId);

      if (sessionsError) {
        console.error('Error deleting user sessions:', sessionsError);
        // Continue anyway
      }

      // Delete user's gallery images
      const { error: galleryError } = await supabase
        .from('gallery_images')
        .delete()
        .eq('user_id', userId);

      if (galleryError) {
        console.error('Error deleting user gallery:', galleryError);
        // Continue anyway
      }

      // Delete user's friend relationships
      const { error: friendsError } = await supabase
        .from('friend_requests')
        .delete()
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (friendsError) {
        console.error('Error deleting friend relationships:', friendsError);
        // Continue anyway
      }

      // Delete user's badges
      const { error: badgesError } = await supabase
        .from('user_badges')
        .delete()
        .eq('user_id', userId);

      if (badgesError) {
        console.error('Error deleting user badges:', badgesError);
        // Continue anyway
      }

      // Delete user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('Error deleting user profile:', profileError);
        // Continue anyway
      }

      // Clear all stored session data
      await SessionManager.clearSessionData();

      // Finally, delete the auth user account
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteUserError) {
        console.error('Error deleting auth user:', deleteUserError);
        // For client-side, we might not have admin access, so try regular sign out
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error('Error signing out after failed deletion:', signOutError);
        }
        return { 
          success: false, 
          error: 'Account data cleared but authentication deletion failed. Please contact support.' 
        };
      }

      console.log('Account deletion completed successfully');
      return { success: true, error: null };

    } catch (error) {
      console.error('Account deletion error:', error);
      return { 
        success: false, 
        error: 'An unexpected error occurred during account deletion. Please try again or contact support.' 
      };
    }
  }

  // Google Sign In
  static async signInWithGoogle(googleUser: any): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      console.log('Attempting Google sign in...');
      
      if (!googleUser.email) {
        return { user: null, error: 'No email found in Google account' };
      }

      const supabase = getSupabase();

      // Use Supabase Auth to check if user exists by trying to get user data
      // Since we can't directly query auth.users, we'll try to sign them in
      // and handle accordingly based on the result
      const { data: { user }, error: getSessionError } = await supabase.auth.getUser();
      
      if (user && user.email === googleUser.email) {
        // User is already signed in
        await SessionManager.storeLastLoginTime();
        console.log('Google sign in successful for existing user');
        return { 
          user: {
            id: user.id,
            email: user.email,
            created_at: user.created_at
          }, 
          error: null 
        };
      } else {
        // User needs to authenticate or doesn't exist
        return { user: null, error: 'GOOGLE_USER_NOT_FOUND' };
      }

    } catch (error) {
      console.error('Google sign in error:', error);
      return { user: null, error: 'Google sign in failed' };
    }
  }

  // Google Registration (for new users) - Modified to work like email registration
  static async registerWithGoogleOAuth(
    profileData: { name: string; age: number; description?: string; riding_experience?: number; stable_id?: string }
  ): Promise<{ user: AuthUser | null; error: string | null; requiresOAuth?: boolean }> {
    try {
      console.log('Starting Google OAuth registration...');
      
      // Validate profile data first
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

      // Initiate Google OAuth - this will redirect the user to Google
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: Platform.OS === 'web' 
            ? `${window.location.origin}/auth/google-callback` 
            : 'com.mojzi1969.EquiHUB://oauth/google-callback',
          // Store profile data in the state parameter to retrieve after OAuth
          queryParams: {
            state: btoa(JSON.stringify(profileData)) // Base64 encode the profile data
          }
        }
      });

      if (error) {
        console.error('Google OAuth initiation error:', error);
        return { user: null, error: error.message };
      }

      if (data.url) {
        // Return special flag indicating OAuth is required
        return { 
          user: null, 
          error: null, 
          requiresOAuth: true 
        };
      }

      return { user: null, error: 'Failed to initiate Google OAuth' };

    } catch (error) {
      console.error('Google registration error:', error);
      return { user: null, error: 'Google registration failed' };
    }
  }

  // Handle Google OAuth callback after user returns from Google
  static async handleGoogleOAuthCallback(url: string): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      console.log('Handling Google OAuth callback...');
      const supabase = getSupabase();

      // Get session from the callback URL
      const { data, error } = await supabase.auth.getSessionFromUrl();

      if (error) {
        console.error('OAuth callback error:', error);
        return { user: null, error: error.message };
      }

      if (!data.session?.user) {
        return { user: null, error: 'No user data received from Google' };
      }

      const authUser = data.session.user;
      
      // Check if this is a new user by looking at creation time vs last sign in
      const isNewUser = new Date(authUser.created_at).getTime() === new Date(authUser.last_sign_in_at || authUser.created_at).getTime();
      
      if (isNewUser) {
        // Extract profile data from state parameter if available
        try {
          const urlObj = new URL(url);
          const state = urlObj.searchParams.get('state');
          if (state) {
            const profileData = JSON.parse(atob(state));
            
            // Update the user metadata with profile data
            const { error: updateError } = await supabase.auth.updateUser({
              data: {
                name: profileData.name,
                age: profileData.age,
                description: profileData.description || 'Equestrian enthusiast',
                riding_experience: profileData.riding_experience || 0,
                stable_id: profileData.stable_id || null
              }
            });

            if (updateError) {
              console.error('Error updating user metadata:', updateError);
            }

            // Also create profile in profiles table if needed
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([{
                id: authUser.id,
                name: profileData.name,
                age: profileData.age,
                description: profileData.description || '',
                experience: profileData.riding_experience || 0,
                profile_image_url: authUser.user_metadata?.avatar_url,
                google_id: authUser.user_metadata?.provider_id,
                auth_provider: 'google',
                is_pro_member: false,
                stable_id: profileData.stable_id
              }]);

            if (profileError && profileError.code !== '23505') {
              console.error('Error creating profile:', profileError);
            }
          }
        } catch (stateError) {
          console.error('Error parsing state parameter:', stateError);
        }
      }

      // Store last login time
      await SessionManager.storeLastLoginTime();

      console.log('Google OAuth registration/login successful');
      return {
        user: {
          id: authUser.id,
          email: authUser.email!,
          created_at: authUser.created_at!
        },
        error: null
      };

    } catch (error) {
      console.error('Google OAuth callback error:', error);
      return { user: null, error: 'Failed to complete Google authentication' };
    }
  }

  // Google OAuth through secure server
  static async googleOAuth(authorizationCode: string, redirectUri?: string): Promise<{ user: any | null; error: string | null }> {
    try {
      const serverUrl = process.env.EXPO_PUBLIC_API_SERVER_URL;
      
      if (!serverUrl) {
        return { user: null, error: 'Server configuration missing' };
      }

      console.log('Exchanging Google authorization code via server...');
      
      // The server will validate the authorization code directly with Google
      // No API secret needed from client - server handles OAuth securely
      const response = await fetch(`${serverUrl}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: authorizationCode,
          redirectUri: redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        console.error('Google OAuth server error:', errorData);
        return { user: null, error: errorData.error || 'Google authentication failed' };
      }

      const data = await response.json();
      console.log('✅ Google OAuth successful:', data.user.email, data.isNewUser ? '(new user)' : '(existing user)');
      
      // Store the Supabase user data in session
      const supabaseUser = data.user;
      
      // Create a session token for the authenticated user
      const sessionData = {
        user: {
          id: supabaseUser.id,
          email: supabaseUser.email,
          name: supabaseUser.name,
          profile_image_url: supabaseUser.profile_image_url,
          google_id: supabaseUser.google_id,
          is_pro_member: supabaseUser.is_pro_member,
          created_at: supabaseUser.created_at
        },
        isNewUser: data.isNewUser,
        googleUser: data.googleUser
      };
      
      // Store user data in AsyncStorage for session management
      await SessionManager.storeLastLoginTime();
      
      // Store user ID for session tracking
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('google_oauth_user_id', supabaseUser.id);
      await AsyncStorage.setItem('google_oauth_user_data', JSON.stringify(sessionData.user));
      
      console.log('✅ Google OAuth session stored successfully');
      
      return { user: sessionData, error: null };
      
    } catch (error) {
      console.error('Google OAuth error:', error);
      return { user: null, error: 'Google authentication failed' };
    }
  }
}
