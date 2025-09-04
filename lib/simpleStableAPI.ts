import { getSupabase } from './supabase';

// Simplified stable interface - just for basic stable information
export interface SimpleStable {
  id: string;
  name: string;
  location?: string;
  city?: string;
  state_province?: string;
  country?: string;
  is_verified?: boolean;
}

// User interface for friend suggestions (with stable information)
export interface UserWithStable {
  id: string;
  name: string;
  age?: number;
  profile_image_url?: string;
  description?: string;
  is_online?: boolean;
  stable_name?: string;
  stable_id?: string;
}

export class SimpleStableAPI {
  // Search for existing stables during registration
  static async searchStables(query: string): Promise<{
    stables: SimpleStable[];
    error: string | null;
  }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select('id, name, location, city, state_province, country, is_verified')
        .or(`name.ilike.%${query}%, location.ilike.%${query}%, city.ilike.%${query}%`)
        .order('is_verified', { ascending: false })
        .order('name', { ascending: true })
        .limit(20);

      if (error) {
        console.error('Error searching stables:', error);
        return { stables: [], error: 'Failed to search stables' };
      }

      return { stables: data || [], error: null };
    } catch (error) {
      console.error('Exception searching stables:', error);
      return { stables: [], error: 'Failed to search stables' };
    }
  }

  // Get popular stables for suggestions during registration
  static async getPopularStables(limit: number = 10): Promise<{
    stables: SimpleStable[];
    error: string | null;
  }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select('id, name, location, city, state_province, country, is_verified')
        .order('is_verified', { ascending: false })
        .order('name', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error getting popular stables:', error);
        return { stables: [], error: 'Failed to load popular stables' };
      }

      return { stables: data || [], error: null };
    } catch (error) {
      console.error('Exception getting popular stables:', error);
      return { stables: [], error: 'Failed to load popular stables' };
    }
  }

  // Create a new stable during registration
  static async createStable(data: {
    name: string;
    location?: string;
    city?: string;
    state_province?: string;
    country?: string;
    creator_id: string;
  }): Promise<{
    stable: SimpleStable | null;
    error: string | null;
  }> {
    try {
      const supabase = getSupabase();
      
      // Create the stable
      const { data: stable, error: stableError } = await supabase
        .from('stables')
        .insert({
          name: data.name,
          location: data.location,
          city: data.city,
          state_province: data.state_province,
          country: data.country,
          is_verified: false // New stables start as unverified
        })
        .select('id, name, location, city, state_province, country, is_verified')
        .single();

      if (stableError) {
        console.error('Error creating stable:', stableError);
        return { stable: null, error: 'Failed to create stable' };
      }

      return { stable, error: null };
    } catch (error) {
      console.error('Exception creating stable:', error);
      return { stable: null, error: 'Failed to create stable' };
    }
  }

  // Get location-based friend suggestions (users from stable_members with same state_province)
  static async getLocationBasedSuggestions(userId: string): Promise<{
    users: UserWithStable[];
    error: string | null;
  }> {
    try {
      const supabase = getSupabase();
      
      // Step 1: Find the user's stable(s) from stable_members table
      const { data: userStables, error: userStablesError } = await supabase
        .from('stable_members')
        .select(`
          stable_id,
          stables (
            id,
            state_province
          )
        `)
        .eq('user_id', userId);

      if (userStablesError) {
        console.error('Error getting user stables from stable_members:', userStablesError);
        return await this.getFallbackSuggestions(userId);
      }

      if (!userStables || userStables.length === 0) {
        console.log('User is not a member of any stable, using fallback suggestions');
        return await this.getFallbackSuggestions(userId);
      }

      // Extract unique state_provinces from user's stables
      const userStateProvinces = [...new Set(
        userStables
          .map((us: any) => us.stables?.state_province)
          .filter((sp: any) => sp) // Remove null/undefined values
      )];

      if (userStateProvinces.length === 0) {
        console.log('User stables have no state_province info, using fallback suggestions');
        return await this.getFallbackSuggestions(userId);
      }

      console.log('User state_provinces:', userStateProvinces);

      // Step 2: Get existing friend IDs to exclude them (check both directions)
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id, user_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (friendshipsError) {
        console.error('Error getting friendships:', friendshipsError);
        // Continue without friendship filtering rather than failing completely
      }

      // Extract friend IDs from both directions
      const friendIds: string[] = [];
      if (friendships) {
        friendships.forEach((friendship: any) => {
          if (friendship.user_id === userId) {
            friendIds.push(friendship.friend_id);
          } else if (friendship.friend_id === userId) {
            friendIds.push(friendship.user_id);
          }
        });
      }
      console.log('Excluding friend IDs:', friendIds);

      // Step 3: Find users from stable_members who are in stables with matching state_provinces
      // First get stable_members in matching stables, then get their profiles separately
      const { data: stableMembersData, error: membersError } = await supabase
        .from('stable_members')
        .select(`
          user_id,
          stable_id,
          stables!inner (
            id,
            name,
            state_province
          )
        `)
        .neq('user_id', userId) // Exclude current user
        .in('stables.state_province', userStateProvinces);

      if (membersError) {
        console.error('Error getting stable members:', membersError);
        return await this.getFallbackSuggestions(userId);
      }

      if (!stableMembersData || stableMembersData.length === 0) {
        console.log('No stable members found in same state_provinces, using fallback');
        return await this.getFallbackSuggestions(userId);
      }

      // Filter out friends and get unique user IDs
      const potentialUserIds = stableMembersData
        .filter((member: any) => !friendIds.includes(member.user_id))
        .map((member: any) => ({ 
          user_id: member.user_id, 
          stable_id: member.stable_id,
          stable_name: member.stables?.name 
        }))
        .slice(0, 8); // Limit to 8 users

      if (potentialUserIds.length === 0) {
        console.log('No non-friend stable members found, using fallback');
        return await this.getFallbackSuggestions(userId);
      }

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, profile_image_url, description')
        .in('id', potentialUserIds.map((u: any) => u.user_id));

      if (profilesError) {
        console.error('Error getting profiles for stable members:', profilesError);
        return await this.getFallbackSuggestions(userId);
      }

      // Combine profile data with stable information
      const users: UserWithStable[] = (profiles || [])
        .map((profile: any) => {
          const stableInfo = potentialUserIds.find((u: any) => u.user_id === profile.id);
          return {
            id: profile.id,
            name: profile.name,
            profile_image_url: profile.profile_image_url,
            description: profile.description,
            is_online: false,
            stable_name: stableInfo?.stable_name,
            stable_id: stableInfo?.stable_id,
          };
        });

      console.log(`Found ${users.length} location-based suggestions from stable_members in same state_province`);
      
      // If we didn't get enough users from location-based search, supplement with fallback
      if (users.length === 0) {
        console.log('No location-based users found, using fallback');
        return await this.getFallbackSuggestions(userId);
      }

      return { users, error: null };
    } catch (error) {
      console.error('Exception getting location-based suggestions:', error);
      return await this.getFallbackSuggestions(userId);
    }
  }

  // Fallback method to get some suggestions when no location info is available
  private static async getFallbackSuggestions(userId: string): Promise<{
    users: UserWithStable[];
    error: string | null;
  }> {
    try {
      const supabase = getSupabase();
      
      // Get existing friend IDs to exclude them (check both directions)
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id, user_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      // Extract friend IDs from both directions
      const friendIds: string[] = [];
      if (friendships) {
        friendships.forEach((friendship: any) => {
          if (friendship.user_id === userId) {
            friendIds.push(friendship.friend_id);
          } else if (friendship.friend_id === userId) {
            friendIds.push(friendship.user_id);
          }
        });
      }

      // Get some random users for suggestions (limit 8, exclude current user and friends)
      // First try to get users who are stable members with their stable info
      const { data: stableMembersData, error: membersError } = await supabase
        .from('stable_members')
        .select(`
          user_id,
          stable_id,
          stables!inner (
            id,
            name
          )
        `)
        .neq('user_id', userId) // Exclude current user
        .limit(20); // Get more to filter out friends

      let fallbackUsers: UserWithStable[] = [];

      if (!membersError && stableMembersData && stableMembersData.length > 0) {
        // Filter out friends
        const potentialUserIds = stableMembersData
          .filter((member: any) => !friendIds.includes(member.user_id))
          .slice(0, 8) // Limit to 8 users
          .map((member: any) => ({ 
            user_id: member.user_id, 
            stable_id: member.stable_id,
            stable_name: member.stables?.name 
          }));

        if (potentialUserIds.length > 0) {
          // Get profiles for these users
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name, profile_image_url, description')
            .in('id', potentialUserIds.map((u: any) => u.user_id));

          if (!profilesError && profiles) {
            fallbackUsers = profiles.map((profile: any) => {
              const stableInfo = potentialUserIds.find((u: any) => u.user_id === profile.id);
              return {
                id: profile.id,
                name: profile.name,
                age: profile.age,
                profile_image_url: profile.profile_image_url,
                description: profile.description,
                is_online: false,
                stable_name: stableInfo?.stable_name,
                stable_id: stableInfo?.stable_id,
              };
            });
          }
        }
      }

      // If we don't have enough users from stable members, supplement with regular profiles
      if (fallbackUsers.length < 8) {
        let profilesQuery = supabase
          .from('profiles')
          .select('id, name, profile_image_url, description')
          .neq('id', userId) // Exclude current user
          .limit(8 - fallbackUsers.length);

        // Exclude existing friends and already found users
        const excludeIds = [...friendIds, ...fallbackUsers.map(u => u.id)];
        if (excludeIds.length > 0) {
          profilesQuery = profilesQuery.not('id', 'in', `(${excludeIds.join(',')})`);
        }

        const { data: plainProfiles, error: plainError } = await profilesQuery;
        
        if (!plainError && plainProfiles) {
          const additionalUsers: UserWithStable[] = plainProfiles.map((profile: any) => ({
            id: profile.id,
            name: profile.name,
            age: profile.age,
            profile_image_url: profile.profile_image_url,
            description: profile.description,
            is_online: false,
            stable_name: undefined,
            stable_id: undefined,
          }));
          
          fallbackUsers = [...fallbackUsers, ...additionalUsers];
        }
      }

      console.log(`Found ${fallbackUsers.length} fallback suggestions`);
      return { users: fallbackUsers, error: null };
    } catch (error) {
      console.error('Exception getting fallback suggestions:', error);
      return { users: [], error: 'Failed to load fallback suggestions' };
    }
  }

  // Get stable info by ID
  static async getStableById(stableId: string): Promise<{
    stable: SimpleStable | null;
    error: string | null;
  }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select('id, name, location, city, state_province, country, is_verified')
        .eq('id', stableId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No stable found
          return { stable: null, error: 'Stable not found' };
        }
        console.error('Error getting stable by ID:', error);
        return { stable: null, error: 'Failed to load stable info' };
      }

      return { stable: data as SimpleStable || null, error: null };
    } catch (error) {
      console.error('Exception getting stable by ID:', error);
      return { stable: null, error: 'Failed to load stable info' };
    }
  }
}
