import { Profile, supabase } from './supabase';

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

      // Log the retrieved experience data specifically
      if (data) {
        console.log('Retrieved profile data:', {
          id: data.id,
          name: data.name,
          age: data.age,
          experience: data.experience,
          is_pro_member: data.is_pro_member
        });
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
      console.log('=== UPDATE PROFILE DEBUG ===');
      console.log('Updating profile for user:', userId);
      console.log('Profile data to update:', JSON.stringify(profileData, null, 2));
      
      // Specifically log experience field updates
      if (profileData.experience !== undefined) {
        console.log('Experience field update:', profileData.experience, 'Type:', typeof profileData.experience);
      }
      if (profileData.is_pro_member !== undefined) {
        console.log('Pro member status update:', profileData.is_pro_member, 'Type:', typeof profileData.is_pro_member);
      }

      const updatePayload = {
        ...profileData,
        updated_at: new Date().toISOString()
      };
      
      console.log('Final update payload:', JSON.stringify(updatePayload, null, 2));

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId)
        .select()

      if (error) {
        console.error('Supabase update error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return false
      }

      console.log('Update successful! Returned data:', JSON.stringify(data, null, 2));
      console.log('Profile updated successfully');
      return true
    } catch (error) {
      console.error('Error in updateProfile:', error)
      return false
    }
  }

  // Update user experience and pro member status specifically
  static async updateMembershipData(userId: string, experience: number, isProMember: boolean): Promise<boolean> {
    try {
      console.log('Updating membership data for user:', userId);
      console.log('Experience:', experience, 'Pro Member:', isProMember);

      const { error } = await supabase
        .from('profiles')
        .update({
          experience: experience,
          is_pro_member: isProMember,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('Error updating membership data:', error)
        return false
      }

      console.log('Membership data updated successfully');
      return true
    } catch (error) {
      console.error('Error in updateMembershipData:', error)
      return false
    }
  }

  // Helper function to determine pro membership status based on experience
  static determineMembershipStatus(experience: number, currentProStatus: boolean = false): boolean {
    // Auto-promote to pro if 5+ years experience OR manually set to pro
    return experience >= 5 || currentProStatus;
  }

  // Get membership display text
  static getMembershipDisplayText(isProMember: boolean): string {
    return isProMember ? "PRO MEMBER" : "RIDER";
  }

  // Update profile with automatic pro membership calculation
  static async updateProfileWithMembershipLogic(userId: string, profileData: Partial<Profile>): Promise<boolean> {
    try {
      console.log('Updating profile with membership logic for user:', userId);
      
      // If experience is being updated, calculate pro status
      if (profileData.experience !== undefined) {
        const currentProStatus = profileData.is_pro_member || false;
        const calculatedProStatus = this.determineMembershipStatus(profileData.experience, currentProStatus);
        
        console.log('Experience:', profileData.experience);
        console.log('Current pro status:', currentProStatus);
        console.log('Calculated pro status:', calculatedProStatus);
        
        profileData.is_pro_member = calculatedProStatus;
      }

      return await this.updateProfile(userId, profileData);
    } catch (error) {
      console.error('Error in updateProfileWithMembershipLogic:', error);
      return false;
    }
  }

  // Batch update multiple profiles with membership logic
  static async batchUpdateProfilesWithMembershipLogic(profileUpdates: Array<{userId: string, profileData: Partial<Profile>}>): Promise<{success: number, failed: number}> {
    let success = 0;
    let failed = 0;

    for (const update of profileUpdates) {
      try {
        const result = await this.updateProfileWithMembershipLogic(update.userId, update.profileData);
        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to update profile ${update.userId}:`, error);
        failed++;
      }
    }

    console.log(`Batch update completed: ${success} successful, ${failed} failed`);
    return { success, failed };
  }

  // Verify database connection and profile table structure
  static async verifyDatabaseConnection(): Promise<boolean> {
    try {
      console.log('Verifying database connection...');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, experience, is_pro_member')
        .limit(1);

      if (error) {
        console.error('Database connection/schema error:', error);
        return false;
      }

      console.log('Database connection verified successfully');
      return true;
    } catch (error) {
      console.error('Error verifying database connection:', error);
      return false;
    }
  }

  // Test experience field operations specifically
  static async testExperienceFieldOperations(userId: string): Promise<boolean> {
    try {
      console.log('=== TESTING EXPERIENCE FIELD OPERATIONS ===');
      console.log('Testing experience field operations for user:', userId);
      
      // Test 1: Try a simple experience-only update
      console.log('Test 1: Updating experience to 7...');
      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({ 
          experience: 7,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
      
      if (updateError) {
        console.error('Direct experience update failed:', updateError);
        return false;
      }
      
      console.log('Direct update result:', updateData);
      
      // Test 2: Retrieve and verify the experience value
      console.log('Test 2: Retrieving profile to verify update...');
      const profile = await this.getProfile(userId);
      
      if (!profile) {
        console.error('Failed to retrieve profile for experience test');
        return false;
      }
      
      console.log('Retrieved profile after update:', {
        experience: profile.experience,
        is_pro_member: profile.is_pro_member
      });
      
      if (profile.experience !== 7) {
        console.error('Experience field mismatch after direct update:', {
          expected: 7,
          actual: profile.experience
        });
        return false;
      }
      
      console.log('✅ Experience field operations test passed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error testing experience field operations:', error);
      return false;
    }
  }

  // Simple function to just update experience without any logic
  static async updateExperienceOnly(userId: string, experience: number): Promise<boolean> {
    try {
      console.log('=== SIMPLE EXPERIENCE UPDATE ===');
      console.log('Updating experience only for user:', userId, 'to:', experience);
      
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          experience: experience,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
      
      if (error) {
        console.error('Simple experience update error:', error);
        return false;
      }
      
      console.log('Simple experience update result:', data);
      return true;
    } catch (error) {
      console.error('Error in updateExperienceOnly:', error);
      return false;
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
