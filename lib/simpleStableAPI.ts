import { getSupabase } from './supabase';

// Simplified stable interface - just for basic affiliation
export interface SimpleStable {
  id: string;
  name: string;
  location?: string;
  city?: string;
  state_province?: string;
  member_count?: number;
  is_verified?: boolean;
}

// User with stable info for friend suggestions
export interface UserWithStable {
  id: string;
  name: string;
  age: number;
  profile_image_url?: string;
  description?: string;
  is_online?: boolean;
  stable_id?: string;
  stable_name?: string;
  stable_location?: string;
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
        .select('id, name, location, city, state_province, member_count, is_verified')
        .or(`name.ilike.%${query}%, location.ilike.%${query}%, city.ilike.%${query}%`)
        .order('is_verified', { ascending: false })
        .order('member_count', { ascending: false })
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
        .select('id, name, location, city, state_province, member_count, is_verified')
        .order('is_verified', { ascending: false })
        .order('member_count', { ascending: false })
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
    description?: string;
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
          description: data.description,
          member_count: 1,
          is_verified: false // New stables start as unverified
        })
        .select('id, name, location, city, state_province, member_count, is_verified')
        .single();

      if (stableError) {
        console.error('Error creating stable:', stableError);
        return { stable: null, error: 'Failed to create stable' };
      }

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('stable_members')
        .insert({
          stable_id: stable.id,
          user_id: data.creator_id,
          role: 'owner',
          joined_at: new Date().toISOString()
        });

      if (memberError) {
        console.error('Error adding creator as member:', memberError);
        // Try to delete the stable since member creation failed
        await supabase.from('stables').delete().eq('id', stable.id);
        return { stable: null, error: 'Failed to create stable membership' };
      }

      return { stable, error: null };
    } catch (error) {
      console.error('Exception creating stable:', error);
      return { stable: null, error: 'Failed to create stable' };
    }
  }

  // Join a stable by ID during registration
  static async joinStable(stableId: string, userId: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const supabase = getSupabase();
      
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('stable_members')
        .select('id')
        .eq('stable_id', stableId)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        return { success: true, error: null }; // Already a member
      }

      // Add user as member
      const { error: memberError } = await supabase
        .from('stable_members')
        .insert({
          stable_id: stableId,
          user_id: userId,
          role: 'member',
          joined_at: new Date().toISOString()
        });

      if (memberError) {
        console.error('Error joining stable:', memberError);
        return { success: false, error: 'Failed to join stable' };
      }

      // Member count is automatically updated by database trigger
      // No need to manually call increment function

      return { success: true, error: null };
    } catch (error) {
      console.error('Exception joining stable:', error);
      return { success: false, error: 'Failed to join stable' };
    }
  }

  // Get users from the same stable for friend suggestions
  static async getStableMatesForSuggestions(userId: string): Promise<{
    users: UserWithStable[];
    error: string | null;
  }> {
    try {
      const supabase = getSupabase();
      
      // Get user's stable
      const { data: userStable } = await supabase
        .from('stable_members')
        .select('stable_id')
        .eq('user_id', userId)
        .single();

      if (!userStable) {
        return { users: [], error: null }; // User not in any stable
      }

      // Get other members from the same stable - use a simpler approach
      const { data: stableMembers, error: membersError } = await supabase
        .from('stable_members')
        .select('user_id')
        .eq('stable_id', userStable.stable_id)
        .neq('user_id', userId) // Exclude the current user
        .limit(10);

      if (membersError) {
        console.error('Error getting stable members:', membersError);
        return { users: [], error: 'Failed to load stable members' };
      }

      if (!stableMembers || stableMembers.length === 0) {
        return { users: [], error: null }; // No other members
      }

      // Get user IDs
      const userIds = stableMembers.map((member: { user_id: string }) => member.user_id);

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, age, profile_image_url, description')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error getting profiles:', profilesError);
        return { users: [], error: 'Failed to load user profiles' };
      }

      // Get stable info
      const { data: stable, error: stableError } = await supabase
        .from('stables')
        .select('id, name, location, city, state_province')
        .eq('id', userStable.stable_id)
        .single();

      if (stableError) {
        console.error('Error getting stable info:', stableError);
        return { users: [], error: 'Failed to load stable info' };
      }

      const users: UserWithStable[] = (profiles || []).map((profile: any) => ({
        id: profile.id,
        name: profile.name,
        age: profile.age,
        profile_image_url: profile.profile_image_url,
        description: profile.description,
        is_online: false, // We can implement online status later if needed
        stable_id: stable.id,
        stable_name: stable.name,
        stable_location: stable.city && stable.state_province 
          ? `${stable.city}, ${stable.state_province}`
          : stable.location
      }));

      return { users, error: null };
    } catch (error) {
      console.error('Exception getting stable mates:', error);
      return { users: [], error: 'Failed to load stable mates' };
    }
  }

  // Get user's current stable info
  static async getUserStable(userId: string): Promise<{
    stable: SimpleStable | null;
    error: string | null;
  }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stable_members')
        .select(`
          stables(
            id,
            name,
            location,
            city,
            state_province,
            member_count,
            is_verified
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No stable found - this is okay
          return { stable: null, error: null };
        }
        console.error('Error getting user stable:', error);
        return { stable: null, error: 'Failed to load stable info' };
      }

      return { stable: data?.stables as SimpleStable || null, error: null };
    } catch (error) {
      console.error('Exception getting user stable:', error);
      return { stable: null, error: 'Failed to load stable info' };
    }
  }
}
