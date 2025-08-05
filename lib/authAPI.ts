import { SessionManager } from './sessionManager';
import { supabase } from './supabase';

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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name.trim(),
            age: data.age,
            description: data.description?.trim() || 'Equestrian enthusiast',
            riding_experience: data.riding_experience || 0
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

  // Get current user session
  static async getCurrentUser(): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Get session error:', error);
        return { user: null, error: error.message };
      }

      if (!session || !session.user) {
        return { user: null, error: null };
      }

      return {
        user: {
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at!
        },
        error: null
      };

    } catch (error) {
      console.error('Get current user error:', error);
      return { user: null, error: 'Failed to get current user.' };
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
}
