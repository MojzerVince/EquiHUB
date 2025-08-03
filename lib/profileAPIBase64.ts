import { supabase, Profile } from './supabase'

export class ProfileAPIBase64 {
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

  // Convert image to Base64 and store in database
  static async uploadProfileImageBase64(userId: string, imageUri: string): Promise<string | null> {
    try {
      console.log('=== BASE64 IMAGE UPLOAD ===');
      console.log('Converting image to Base64:', imageUri);

      // Fetch the image
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      // Convert to blob
      const blob = await response.blob();
      console.log('Image blob size:', blob.size, 'type:', blob.type);

      // Convert blob to Base64
      const base64 = await this.blobToBase64(blob);
      console.log('Base64 conversion successful, length:', base64.length);

      // Create data URL
      const mimeType = blob.type || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      console.log('Data URL created, total size:', dataUrl.length);

      // Store Base64 string directly in profile_image_url field
      const success = await this.updateProfile(userId, {
        profile_image_url: dataUrl
      });

      if (!success) {
        throw new Error('Failed to update profile with Base64 image');
      }

      console.log('✅ Base64 image stored in database successfully');
      return dataUrl;

    } catch (error) {
      console.error('❌ Base64 image upload failed:', error);
      return null;
    }
  }

  // Helper function to convert blob to Base64
  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          // Remove the data URL prefix to get just the Base64 string
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to Base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
