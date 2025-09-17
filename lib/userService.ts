/**
 * User Service - Handles user authentication and database operations with Supabase
 */
import { getSupabase } from './supabase';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

export interface SupabaseUser {
  id: string;
  email: string;
  name: string;
  google_id: string;
  profile_image_url?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Authenticates or creates a user in Supabase using Google credentials
 * This function will:
 * 1. Check if user exists in Supabase based on Google ID
 * 2. If not, create a new user record
 * 3. If exists, update the user record with latest Google info
 * 4. Return the authenticated user data
 */
export const authenticateGoogleUser = async (googleUser: GoogleUser): Promise<{ user: SupabaseUser; isNewUser: boolean }> => {
  try {
    const supabase = getSupabase();
    
    console.log('🔍 Authenticating Google user:', googleUser.email);
    
    // Check if user already exists by Google ID
    const { data: existingUser, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('google_id', googleUser.id)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for new users
      console.error('Error checking existing user:', fetchError);
      throw fetchError;
    }
    
    let user: SupabaseUser;
    let isNewUser = false;
    
    if (existingUser) {
      console.log('✅ Existing user found, updating profile');
      
      // Update existing user with latest Google info
      const { data: updatedUser, error: updateError } = await supabase
        .from('profiles')
        .update({
          email: googleUser.email,
          name: googleUser.name,
          profile_image_url: googleUser.picture,
          updated_at: new Date().toISOString()
        })
        .eq('google_id', googleUser.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating user:', updateError);
        throw updateError;
      }
      
      user = updatedUser;
    } else {
      console.log('🆕 New user, creating profile');
      isNewUser = true;
      
      // Create new user record
      const newUserData = {
        email: googleUser.email,
        name: googleUser.name,
        google_id: googleUser.id,
        profile_image_url: googleUser.picture,
        age: 0, // Default value, user can update later
        description: '', // Default empty description
        experience: 0, // Default beginner level
        is_pro_member: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: createdUser, error: createError } = await supabase
        .from('profiles')
        .insert([newUserData])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating user:', createError);
        throw createError;
      }
      
      user = createdUser;
      console.log('✅ New user created successfully');
    }
    
    return { user, isNewUser };
  } catch (error) {
    console.error('❌ Error in authenticateGoogleUser:', error);
    throw error;
  }
};

/**
 * Get user profile by ID
 */
export const getUserProfile = async (userId: string): Promise<SupabaseUser | null> => {
  try {
    const supabase = getSupabase();
    
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // User not found
      }
      throw error;
    }
    
    return user;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId: string, updates: Partial<SupabaseUser>): Promise<SupabaseUser> => {
  try {
    const supabase = getSupabase();
    
    const { data: updatedUser, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return updatedUser;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};