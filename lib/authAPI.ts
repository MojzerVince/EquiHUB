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

      // Check if user already exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', googleUser.email)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing user:', fetchError);
        return { user: null, error: 'Database error occurred' };
      }

      if (existingUser) {
        // User exists, store login time and return user
        await SessionManager.storeLastLoginTime();
        console.log('Google sign in successful for existing user');
        return { 
          user: {
            id: existingUser.id,
            email: existingUser.email,
            created_at: existingUser.created_at
          }, 
          error: null 
        };
      } else {
        // User doesn't exist, they need to register
        return { user: null, error: 'GOOGLE_USER_NOT_FOUND' };
      }

    } catch (error) {
      console.error('Google sign in error:', error);
      return { user: null, error: 'Google sign in failed' };
    }
  }

  // Google Registration (for new users)
  static async registerWithGoogle(
    googleUser: any, 
    profileData: { name: string; age: number; description?: string; riding_experience?: number; stable_id?: string }
  ): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      console.log('Attempting Google registration...');
      
      if (!googleUser.email) {
        return { user: null, error: 'No email found in Google account' };
      }

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

      // Check if user already exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', googleUser.email)
        .single();

      if (existingUser) {
        return { user: null, error: 'User already exists with this Google account. Please sign in instead.' };
      }

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing user:', fetchError);
        return { user: null, error: 'Database error occurred' };
      }

      // Create new user profile
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          email: googleUser.email,
          name: profileData.name,
          age: profileData.age,
          description: profileData.description || '',
          riding_experience: profileData.riding_experience || 0,
          auth_provider: 'google',
          google_id: googleUser.id
        }])
        .select()
        .single();

      if (insertError) {
        console.error('User registration error:', insertError);
        if (insertError.code === '23505') {
          return { user: null, error: 'A user with this email already exists' };
        }
        return { user: null, error: 'Failed to create user account' };
      }

      // Join stable if provided
      if (profileData.stable_id && newUser) {
        try {
          const { error: stableError } = await supabase
            .from('stable_members')
            .insert([{
              stable_id: profileData.stable_id,
              user_id: newUser.id,
              role: 'member',
              joined_at: new Date().toISOString()
            }]);

          if (stableError) {
            console.error('Error joining stable:', stableError);
            // Don't fail registration if stable join fails
          }
        } catch (stableJoinError) {
          console.error('Stable join error:', stableJoinError);
          // Don't fail registration if stable join fails
        }
      }

      // Store last login time for session tracking
      await SessionManager.storeLastLoginTime();

      console.log('Google registration successful');
      return { 
        user: {
          id: newUser.id,
          email: newUser.email,
          created_at: newUser.created_at
        }, 
        error: null 
      };

    } catch (error) {
      console.error('Google registration error:', error);
      return { user: null, error: 'Google registration failed' };
    }
  }
}
