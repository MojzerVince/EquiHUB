import { supabase, Profile } from './supabase'

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

  // Create new profile
  static async createProfile(profileData: Omit<Profile, 'id' | 'created_at' | 'updated_at'>): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{
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
      // Convert image URI to blob for upload
      const response = await fetch(imageUri)
      const blob = await response.blob()
      
      const fileExt = imageUri.split('.').pop()
      const fileName = `${userId}/profile.${fileExt}`

      const { data, error } = await supabase.storage
        .from('profile-images')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        console.error('Error uploading image:', error)
        return null
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName)

      return urlData.publicUrl
    } catch (error) {
      console.error('Error in uploadProfileImage:', error)
      return null
    }
  }
}
