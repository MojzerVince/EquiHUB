import { Badge, Profile, supabase, UserBadgeWithDetails } from './supabase';

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

      // Return the data if found
      return data
    } catch (error) {
      console.error('Error in getProfile:', error)
      return null
    }
  }

  // Update user profile
  static async updateProfile(userId: string, profileData: Partial<Profile>): Promise<boolean> {
    try {
      
      const updatePayload = {
        ...profileData,
        updated_at: new Date().toISOString()
      };

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

      return true
    } catch (error) {
      console.error('Error in updateProfile:', error)
      return false
    }
  }

  // Update user experience and pro member status specifically
  static async updateMembershipData(userId: string, experience: number, isProMember: boolean): Promise<boolean> {
    try {

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
      
      // If experience is being updated, calculate pro status
      if (profileData.experience !== undefined) {
        const currentProStatus = profileData.is_pro_member || false;
        const calculatedProStatus = this.determineMembershipStatus(profileData.experience, currentProStatus);
        
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

    return { success, failed };
  }

  // Verify database connection and profile table structure
  static async verifyDatabaseConnection(): Promise<boolean> {
    try {
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, experience, is_pro_member')
        .limit(1);

      if (error) {
        console.error('Database connection/schema error:', error);
        return false;
      }

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

  // Badge-related functions

  // Get all badges for a user
  static async getUserBadges(userId: string): Promise<UserBadgeWithDetails[]> {
    try {
      console.log('Fetching badges for user:', userId);

      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          *,
          badge:badges!user_badges_badge_id_fkey(*)
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      if (error) {
        console.error('Error fetching user badges:', error);
        return [];
      }

      console.log('Retrieved user badges:', data);
      return data || [];
    } catch (error) {
      console.error('Error in getUserBadges:', error);
      return [];
    }
  }

  // Award a badge to a user
  static async awardBadge(userId: string, badgeId: string, metadata?: any): Promise<boolean> {
    try {
      console.log('Awarding badge to user:', { userId, badgeId, metadata });

      // Check if user already has this badge
      const { data: existingBadge } = await supabase
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_id', badgeId)
        .single();

      if (existingBadge) {
        console.log('User already has this badge');
        return false;
      }

      const { data, error } = await supabase
        .from('user_badges')
        .insert([{
          user_id: userId,
          badge_id: badgeId,
          earned_at: new Date().toISOString(),
          progress: 100,
          metadata: metadata || {}
        }])
        .select()
        .single();

      if (error) {
        console.error('Error awarding badge:', error);
        return false;
      }

      console.log('Badge awarded successfully:', data);
      return true;
    } catch (error) {
      console.error('Error in awardBadge:', error);
      return false;
    }
  }

  // Get all available badge definitions
  static async getBadgeDefinitions(): Promise<Badge[]> {
    try {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('rarity', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching badge definitions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getBadgeDefinitions:', error);
      return [];
    }
  }

  // Get user badge statistics
  static async getUserBadgeStats(userId: string): Promise<{
    totalBadges: number;
    legendaryBadges: number;
    epicBadges: number;
    rareBadges: number;
    commonBadges: number;
    categories: { [key: string]: number };
  }> {
    try {
      const userBadges = await this.getUserBadges(userId);
      
      const stats = {
        totalBadges: userBadges.length,
        legendaryBadges: 0,
        epicBadges: 0,
        rareBadges: 0,
        commonBadges: 0,
        categories: {} as { [key: string]: number }
      };

      userBadges.forEach(userBadge => {
        const badge = userBadge.badge;

        // Count by rarity
        switch (badge.rarity) {
          case 'legendary':
            stats.legendaryBadges++;
            break;
          case 'epic':
            stats.epicBadges++;
            break;
          case 'rare':
            stats.rareBadges++;
            break;
          case 'common':
            stats.commonBadges++;
            break;
        }

        // Count by category
        stats.categories[badge.category] = (stats.categories[badge.category] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error in getUserBadgeStats:', error);
      return {
        totalBadges: 0,
        legendaryBadges: 0,
        epicBadges: 0,
        rareBadges: 0,
        commonBadges: 0,
        categories: {}
      };
    }
  }

  // Check badge eligibility and award automatic badges
  static async checkBadgeEligibility(userId: string): Promise<string[]> {
    try {
      console.log('Checking badge eligibility for user:', userId);
      
      const awardedBadges: string[] = [];
      const profile = await this.getProfile(userId);
      
      if (!profile) {
        console.log('Profile not found for badge eligibility check');
        return awardedBadges;
      }

      // Get available badges
      const badges = await this.getBadgeDefinitions();
      const userBadges = await this.getUserBadges(userId);
      const userBadgeIds = userBadges.map(ub => ub.badge_id);

      // Check eligibility for each badge
      for (const badge of badges) {
        // Skip if user already has this badge
        if (userBadgeIds.includes(badge.id)) {
          continue;
        }

        let shouldAward = false;
        const metadata: any = {};

        // Badge eligibility logic
        switch (badge.name) {
          case 'Newcomer':
            // Award when profile is complete
            shouldAward = !!(profile.name && profile.age && profile.description);
            metadata.reason = 'Profile completed';
            break;

          case 'Veteran':
            // Award for 5+ years experience
            shouldAward = (profile.experience || 0) >= 5;
            metadata.reason = `${profile.experience} years of experience`;
            break;

          case 'Trainer':
            // Award for pro members
            shouldAward = profile.is_pro_member === true;
            metadata.reason = 'Pro member status achieved';
            break;

          // Add more badge logic here as needed
        }

        if (shouldAward) {
          const success = await this.awardBadge(userId, badge.id, metadata);
          if (success) {
            awardedBadges.push(badge.name);
            console.log('Auto-awarded badge:', badge.name);
          }
        }
      }

      console.log('Badge eligibility check complete. Awarded:', awardedBadges);
      return awardedBadges;
    } catch (error) {
      console.error('Error in checkBadgeEligibility:', error);
      return [];
    }
  }

  // Remove a badge from a user (admin function)
  static async removeBadge(userId: string, badgeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_badges')
        .delete()
        .eq('user_id', userId)
        .eq('badge_id', badgeId);

      if (error) {
        console.error('Error removing badge:', error);
        return false;
      }

      console.log('Badge removed successfully');
      return true;
    } catch (error) {
      console.error('Error in removeBadge:', error);
      return false;
    }
  }
}
