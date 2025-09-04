import { getSupabase } from './supabase';

export interface Stable {
  id: string;
  name: string;
  location?: string;
  country?: string;
  state_province?: string;
  city?: string;
  address?: string;
  cover_image_url?: string;
  created_at: string;
  updated_at: string;
  is_verified: boolean;
  is_public: boolean;
  join_code?: string;
  search_vector?: string;
}

export interface CreateStableData {
  name: string;
  location?: string;
  country?: string;
  state_province?: string;
  city?: string;
  address?: string;
  cover_image_url?: string;
  is_public?: boolean;
}

export class StableAPI {
  // Search for stables
  static async searchStables(
    query?: string,
    country?: string,
    state_province?: string,
    city?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ stables: Stable[]; error: string | null }> {
    try {
      const supabase = getSupabase();
      let queryBuilder = supabase
        .from('stables')
        .select('id, name, location, country, state_province, city, address, cover_image_url, created_at, updated_at, is_verified, is_public, join_code, search_vector')
        .eq('is_public', true)
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      // Add text search if query provided
      if (query && query.trim()) {
        queryBuilder = queryBuilder.textSearch('search_vector', query.trim());
      }

      // Add location filters
      if (country) {
        queryBuilder = queryBuilder.eq('country', country);
      }
      if (state_province) {
        queryBuilder = queryBuilder.eq('state_province', state_province);
      }
      if (city) {
        queryBuilder = queryBuilder.eq('city', city);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Error searching stables:', error);
        return { stables: [], error: error.message };
      }

      return { stables: data || [], error: null };
    } catch (error) {
      console.error('Error in searchStables:', error);
      return { stables: [], error: 'Failed to search stables' };
    }
  }

  // Get stable by ID
  static async getStable(stableId: string): Promise<{ stable: Stable | null; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select('id, name, location, country, state_province, city, address, cover_image_url, created_at, updated_at, is_verified, is_public, join_code, search_vector')
        .eq('id', stableId)
        .single();

      if (error) {
        console.error('Error getting stable:', error);
        return { stable: null, error: error.message };
      }

      return { stable: data, error: null };
    } catch (error) {
      console.error('Error in getStable:', error);
      return { stable: null, error: 'Failed to get stable' };
    }
  }

  // Get stable by join code
  static async getStableByJoinCode(joinCode: string): Promise<{ stable: Stable | null; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select('id, name, location, country, state_province, city, address, cover_image_url, created_at, updated_at, is_verified, is_public, join_code, search_vector')
        .eq('join_code', joinCode.toUpperCase())
        .single();

      if (error) {
        console.error('Error getting stable by join code:', error);
        return { stable: null, error: 'Stable not found with that join code' };
      }

      return { stable: data, error: null };
    } catch (error) {
      console.error('Error in getStableByJoinCode:', error);
      return { stable: null, error: 'Failed to find stable' };
    }
  }

  // Create a new stable
  static async createStable(data: CreateStableData): Promise<{ stable: Stable | null; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { stable: null, error: 'User not authenticated' };
      }

      // Generate join code if stable is public
      let joinCode: string | null = null;
      if (data.is_public !== false) {
        const { data: codeData, error: codeError } = await supabase.rpc('generate_join_code');
        if (!codeError && codeData) {
          joinCode = codeData;
        }
      }

      const stableData = {
        name: data.name,
        location: data.location,
        country: data.country,
        state_province: data.state_province,
        city: data.city,
        address: data.address,
        cover_image_url: data.cover_image_url,
        join_code: joinCode,
        is_public: data.is_public !== false, // Default to true
      };

      const { data: stable, error } = await supabase
        .from('stables')
        .insert(stableData)
        .select('id, name, location, country, state_province, city, address, cover_image_url, created_at, updated_at, is_verified, is_public, join_code, search_vector')
        .single();

      if (error) {
        console.error('Error creating stable:', error);
        return { stable: null, error: error.message };
      }

      // Update user's profile with the new stable
      await supabase
        .from('profiles')
        .update({ stable_id: stable.id })
        .eq('id', user.id);

      return { stable, error: null };
    } catch (error) {
      console.error('Error in createStable:', error);
      return { stable: null, error: 'Failed to create stable' };
    }
  }

  // Get popular stables (for recommendations)
  static async getPopularStables(limit: number = 10): Promise<{ stables: Stable[]; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select('id, name, location, country, state_province, city, address, cover_image_url, created_at, updated_at, is_verified, is_public, join_code, search_vector')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting popular stables:', error);
        return { stables: [], error: error.message };
      }

      return { stables: data || [], error: null };
    } catch (error) {
      console.error('Error in getPopularStables:', error);
      return { stables: [], error: 'Failed to get popular stables' };
    }
  }

  // Update stable
  static async updateStable(stableId: string, data: Partial<CreateStableData>): Promise<{ stable: Stable | null; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { stable: null, error: 'User not authenticated' };
      }

      const updateData = {
        ...(data.name && { name: data.name }),
        ...(data.location && { location: data.location }),
        ...(data.country && { country: data.country }),
        ...(data.state_province && { state_province: data.state_province }),
        ...(data.city && { city: data.city }),
        ...(data.address && { address: data.address }),
        ...(data.cover_image_url && { cover_image_url: data.cover_image_url }),
        ...(data.is_public !== undefined && { is_public: data.is_public }),
        updated_at: new Date().toISOString()
      };

      const { data: stable, error } = await supabase
        .from('stables')
        .update(updateData)
        .eq('id', stableId)
        .select('id, name, location, country, state_province, city, address, cover_image_url, created_at, updated_at, is_verified, is_public, join_code, search_vector')
        .single();

      if (error) {
        console.error('Error updating stable:', error);
        return { stable: null, error: error.message };
      }

      return { stable, error: null };
    } catch (error) {
      console.error('Error in updateStable:', error);
      return { stable: null, error: 'Failed to update stable' };
    }
  }

  // Get countries that have stables
  static async getCountriesWithStables(): Promise<{ countries: string[]; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select('country')
        .eq('is_public', true)
        .not('country', 'is', null);

      if (error) {
        console.error('Error getting countries:', error);
        return { countries: [], error: error.message };
      }

      const countries = [...new Set(data.map((item: { country: string }) => item.country).filter(Boolean))].sort() as string[];
      return { countries, error: null };
    } catch (error) {
      console.error('Error in getCountriesWithStables:', error);
      return { countries: [], error: 'Failed to get countries' };
    }
  }

  // Get states/provinces for a country
  static async getStatesForCountry(country: string): Promise<{ states: string[]; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select('state_province')
        .eq('country', country)
        .eq('is_public', true)
        .not('state_province', 'is', null);

      if (error) {
        console.error('Error getting states:', error);
        return { states: [], error: error.message };
      }

      const states = [...new Set(data.map((item: { state_province: string }) => item.state_province).filter(Boolean))].sort() as string[];
      return { states, error: null };
    } catch (error) {
      console.error('Error in getStatesForCountry:', error);
      return { states: [], error: 'Failed to get states' };
    }
  }
}
