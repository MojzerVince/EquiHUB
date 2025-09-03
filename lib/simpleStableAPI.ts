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

// User interface for friend suggestions (without stable-based suggestions)
export interface UserWithStable {
  id: string;
  name: string;
  age?: number;
  profile_image_url?: string;
  description?: string;
  is_online?: boolean;
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

  // Get location-based friend suggestions (without stable membership dependency)
  static async getLocationBasedSuggestions(userId: string): Promise<{
    users: UserWithStable[];
    error: string | null;
  }> {
    try {
      const supabase = getSupabase();
      
      // Get existing friend IDs to exclude them
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (friendshipsError) {
        console.error('Error getting friendships:', friendshipsError);
        // Continue without friendship filtering rather than failing completely
      }

      const friendIds = friendships?.map((f: any) => f.friend_id) || [];
      console.log('Excluding friend IDs:', friendIds);

      // Get random users for suggestions (limit 8, exclude current user and friends)
      let profilesQuery = supabase
        .from('profiles')
        .select('id, name, profile_image_url, description')
        .neq('id', userId); // Exclude current user

      // Also exclude existing friends if any
      if (friendIds.length > 0) {
        profilesQuery = profilesQuery.not('id', 'in', `(${friendIds.join(',')})`);
      }

      const { data: profiles, error: profilesError } = await profilesQuery.limit(8);

      if (profilesError) {
        console.error('Error getting profiles:', profilesError);
        return { users: [], error: 'Failed to load user profiles' };
      }

      if (!profiles || profiles.length === 0) {
        return { users: [], error: null }; // No users found
      }

      const users: UserWithStable[] = profiles.map((profile: any) => ({
        id: profile.id,
        name: profile.name,
        age: profile.age,
        profile_image_url: profile.profile_image_url,
        description: profile.description,
        is_online: false, // We can implement online status later if needed
      }));

      console.log(`Found ${users.length} suggestions`);
      return { users, error: null };
    } catch (error) {
      console.error('Exception getting suggestions:', error);
      return { users: [], error: 'Failed to load suggestions' };
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
