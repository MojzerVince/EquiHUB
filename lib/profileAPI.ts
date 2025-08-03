import { supabase, Profile, supabaseUrl, supabaseAnonKey } from './supabase'

export class ProfileAPI {
  // Get user profile
  static async getProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getProfile:', error)
      return null
    }
  }

  // Update user profile
  static async updateProfile(userId: string, profileData: Partial<Profile>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('Error updating profile:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateProfile:', error)
      return false
    }
  }

  // Create new profile with specific ID
  static async createProfile(userId: string, profileData: Omit<Profile, 'id' | 'created_at' | 'updated_at'>): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          ...profileData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in createProfile:', error)
      return null
    }
  }

  // Upload profile image
  static async uploadProfileImage(userId: string, imageUri: string): Promise<string | null> {
    try {
      console.log('=== IMAGE UPLOAD DEBUG ===');
      console.log('Starting image upload for:', userId);
      console.log('Image URI:', imageUri);

      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `${userId}/profile.${fileExt}`;
      console.log('File name:', fileName);
      
      // For React Native, create a blob from the image URI
      console.log('Fetching image from URI...');
      const response = await fetch(imageUri);
      console.log('Fetch response status:', response.status);
      
      const blob = await response.blob();
      console.log('Blob created - size:', blob.size, 'type:', blob.type);

      // Upload to Supabase Storage
      console.log('Uploading to Supabase Storage...');
      const { data, error } = await supabase.storage
        .from('profile-images')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: `image/${fileExt}`
        })

      if (error) {
        console.error('Supabase storage error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error
      }

      console.log('Upload successful! Data:', JSON.stringify(data, null, 2));

      // Get public URL
      console.log('Getting public URL...');
      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName)

      console.log('Public URL generated:', urlData.publicUrl);
      console.log('=== IMAGE UPLOAD SUCCESS ===');
      return urlData.publicUrl
    } catch (error) {
      console.error('=== IMAGE UPLOAD ERROR ===');
      console.error('Error in uploadProfileImage:', error);
      
      // If the error is about the storage bucket not existing, provide helpful info
      if (error instanceof Error && error.message?.includes('Bucket not found')) {
        console.error('SOLUTION: Create the "profile-images" storage bucket in your Supabase dashboard')
      }
      
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      console.log('=== IMAGE UPLOAD FAILED ===');
      return null
    }
  }
}
