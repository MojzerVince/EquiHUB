import { getSupabase } from './supabase';

export interface Stable {
  id: string;
  name: string;
  description?: string;
  location?: string;
  country?: string;
  state_province?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  cover_image_url?: string;
  owner_id?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_verified: boolean;
  member_count: number;
  max_members: number;
  is_public: boolean;
  join_code?: string;
  specialties?: string[];
  facilities?: string[];
  business_hours?: any;
  pricing_info?: string;
  social_media?: any;
  search_vector?: string;
}

export interface StableMember {
  id: string;
  stable_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'instructor' | 'member';
  joined_at: string;
  invited_by?: string;
  is_active: boolean;
  notes?: string;
  member_number?: string;
  emergency_contact?: any;
}

export interface StableInvitation {
  id: string;
  stable_id: string;
  inviter_id: string;
  invitee_id?: string;
  invitee_email?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  role: 'admin' | 'instructor' | 'member';
  message?: string;
  expires_at: string;
  created_at: string;
  responded_at?: string;
}

export interface CreateStableData {
  name: string;
  description?: string;
  location?: string;
  country?: string;
  state_province?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  cover_image_url?: string;
  max_members?: number;
  is_public?: boolean;
  specialties?: string[];
  facilities?: string[];
  business_hours?: any;
  pricing_info?: string;
  social_media?: any;
}

export interface StableWithMemberInfo extends Stable {
  user_role?: string;
  user_joined_at?: string;
  is_member?: boolean;
}

export class StableAPI {
  // Search for stables
  static async searchStables(
    query?: string,
    country?: string,
    state_province?: string,
    city?: string,
    specialties?: string[],
    limit: number = 20,
    offset: number = 0
  ): Promise<{ stables: StableWithMemberInfo[]; error: string | null }> {
    try {
      const supabase = getSupabase();
      let queryBuilder = supabase
        .from('stables')
        .select(`
          *,
          stable_members!left(
            role,
            joined_at,
            is_active,
            user_id
          )
        `)
        .eq('is_active', true)
        .eq('is_public', true)
        .range(offset, offset + limit - 1)
        .order('member_count', { ascending: false });

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

      // Add specialties filter
      if (specialties && specialties.length > 0) {
        queryBuilder = queryBuilder.overlaps('specialties', specialties);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Error searching stables:', error);
        return { stables: [], error: error.message };
      }

      // Get current user to determine membership status
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Transform data to include membership info
      const stablesWithMemberInfo: StableWithMemberInfo[] = (data || []).map((stable: any) => {
        const userMembership = stable.stable_members?.find((member: any) => 
          member.user_id === currentUserId && member.is_active
        );

        return {
          ...stable,
          stable_members: undefined, // Remove the join data from the response
          user_role: userMembership?.role,
          user_joined_at: userMembership?.joined_at,
          is_member: !!userMembership
        };
      });

      return { stables: stablesWithMemberInfo, error: null };
    } catch (error) {
      console.error('Error in searchStables:', error);
      return { stables: [], error: 'Failed to search stables' };
    }
  }

  // Get stable by ID
  static async getStable(stableId: string): Promise<{ stable: StableWithMemberInfo | null; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select(`
          *,
          stable_members!left(
            role,
            joined_at,
            is_active,
            user_id
          )
        `)
        .eq('id', stableId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error getting stable:', error);
        return { stable: null, error: error.message };
      }

      if (!data) {
        return { stable: null, error: 'Stable not found' };
      }

      // Get current user to determine membership status
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      const userMembership = data.stable_members?.find((member: any) => 
        member.user_id === currentUserId && member.is_active
      );

      const stableWithMemberInfo: StableWithMemberInfo = {
        ...data,
        stable_members: undefined, // Remove the join data from the response
        user_role: userMembership?.role,
        user_joined_at: userMembership?.joined_at,
        is_member: !!userMembership
      };

      return { stable: stableWithMemberInfo, error: null };
    } catch (error) {
      console.error('Error in getStable:', error);
      return { stable: null, error: 'Failed to get stable' };
    }
  }

  // Get stable by join code
  static async getStableByJoinCode(joinCode: string): Promise<{ stable: StableWithMemberInfo | null; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select(`
          *,
          stable_members!left(
            role,
            joined_at,
            is_active,
            user_id
          )
        `)
        .eq('join_code', joinCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error getting stable by join code:', error);
        return { stable: null, error: 'Stable not found with that join code' };
      }

      if (!data) {
        return { stable: null, error: 'Stable not found with that join code' };
      }

      // Get current user to determine membership status
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      const userMembership = data.stable_members?.find((member: any) => 
        member.user_id === currentUserId && member.is_active
      );

      const stableWithMemberInfo: StableWithMemberInfo = {
        ...data,
        stable_members: undefined,
        user_role: userMembership?.role,
        user_joined_at: userMembership?.joined_at,
        is_member: !!userMembership
      };

      return { stable: stableWithMemberInfo, error: null };
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
        ...data,
        owner_id: user.id,
        join_code: joinCode,
        is_public: data.is_public !== false, // Default to true
        max_members: data.max_members || 100,
        member_count: 1 // Owner is the first member
      };

      const { data: stable, error } = await supabase
        .from('stables')
        .insert(stableData)
        .select()
        .single();

      if (error) {
        console.error('Error creating stable:', error);
        return { stable: null, error: error.message };
      }

      // Add the owner as the first member
      const { error: memberError } = await supabase
        .from('stable_members')
        .insert({
          stable_id: stable.id,
          user_id: user.id,
          role: 'owner',
          is_active: true
        });

      if (memberError) {
        console.error('Error adding owner as member:', memberError);
        // Try to clean up the stable if member creation failed
        await supabase.from('stables').delete().eq('id', stable.id);
        return { stable: null, error: 'Failed to create stable membership' };
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

  // Join a stable
  static async joinStable(stableId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Check if stable exists and is public
      const { data: stable, error: stableError } = await supabase
        .from('stables')
        .select('id, is_public, member_count, max_members')
        .eq('id', stableId)
        .eq('is_active', true)
        .single();

      if (stableError || !stable) {
        return { success: false, error: 'Stable not found' };
      }

      if (!stable.is_public) {
        return { success: false, error: 'This stable requires an invitation to join' };
      }

      if (stable.member_count >= stable.max_members) {
        return { success: false, error: 'This stable is at maximum capacity' };
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('stable_members')
        .select('id, is_active')
        .eq('stable_id', stableId)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        if (existingMember.is_active) {
          return { success: false, error: 'You are already a member of this stable' };
        } else {
          // Reactivate membership
          const { error: updateError } = await supabase
            .from('stable_members')
            .update({ is_active: true, joined_at: new Date().toISOString() })
            .eq('id', existingMember.id);

          if (updateError) {
            return { success: false, error: 'Failed to rejoin stable' };
          }
        }
      } else {
        // Create new membership
        const { error: memberError } = await supabase
          .from('stable_members')
          .insert({
            stable_id: stableId,
            user_id: user.id,
            role: 'member',
            is_active: true
          });

        if (memberError) {
          console.error('Error joining stable:', memberError);
          return { success: false, error: 'Failed to join stable' };
        }
      }

      // Update user's profile with the new stable (if they don't have one set)
      const { data: profile } = await supabase
        .from('profiles')
        .select('stable_id')
        .eq('id', user.id)
        .single();

      if (profile && !profile.stable_id) {
        await supabase
          .from('profiles')
          .update({ stable_id: stableId })
          .eq('id', user.id);
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error in joinStable:', error);
      return { success: false, error: 'Failed to join stable' };
    }
  }

  // Join stable by join code
  static async joinStableByCode(joinCode: string): Promise<{ success: boolean; stable?: Stable; error: string | null }> {
    try {
      const { stable, error } = await this.getStableByJoinCode(joinCode);
      
      if (error || !stable) {
        return { success: false, error: error || 'Stable not found' };
      }

      const joinResult = await this.joinStable(stable.id);
      
      if (!joinResult.success) {
        return { success: false, error: joinResult.error };
      }

      return { success: true, stable, error: null };
    } catch (error) {
      console.error('Error in joinStableByCode:', error);
      return { success: false, error: 'Failed to join stable' };
    }
  }

  // Leave a stable
  static async leaveStable(stableId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Check if user is a member
      const { data: membership, error: memberError } = await supabase
        .from('stable_members')
        .select('id, role')
        .eq('stable_id', stableId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (memberError || !membership) {
        return { success: false, error: 'You are not a member of this stable' };
      }

      // Owners cannot leave their own stable (they must transfer ownership first)
      if (membership.role === 'owner') {
        return { success: false, error: 'Stable owners cannot leave. Please transfer ownership first.' };
      }

      // Deactivate membership
      const { error: updateError } = await supabase
        .from('stable_members')
        .update({ is_active: false })
        .eq('id', membership.id);

      if (updateError) {
        console.error('Error leaving stable:', updateError);
        return { success: false, error: 'Failed to leave stable' };
      }

      // Update user's profile to remove stable if this was their primary stable
      const { data: profile } = await supabase
        .from('profiles')
        .select('stable_id')
        .eq('id', user.id)
        .single();

      if (profile && profile.stable_id === stableId) {
        await supabase
          .from('profiles')
          .update({ stable_id: null })
          .eq('id', user.id);
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error in leaveStable:', error);
      return { success: false, error: 'Failed to leave stable' };
    }
  }

  // Get user's stables
  static async getUserStables(userId?: string): Promise<{ stables: StableWithMemberInfo[]; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { stables: [], error: 'User not authenticated' };
        }
        targetUserId = user.id;
      }

      const { data, error } = await supabase
        .from('stable_members')
        .select(`
          role,
          joined_at,
          is_active,
          stable_id,
          stables:stable_id (*)
        `)
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .order('joined_at', { ascending: false });

      if (error) {
        console.error('Error getting user stables:', error);
        return { stables: [], error: error.message };
      }

      const stables: StableWithMemberInfo[] = (data || []).map((membership: any) => ({
        ...membership.stables,
        user_role: membership.role,
        user_joined_at: membership.joined_at,
        is_member: true
      }));

      return { stables, error: null };
    } catch (error) {
      console.error('Error in getUserStables:', error);
      return { stables: [], error: 'Failed to get user stables' };
    }
  }

  // Get popular stables (for recommendations)
  static async getPopularStables(limit: number = 10): Promise<{ stables: StableWithMemberInfo[]; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select(`
          *,
          stable_members!left(
            role,
            joined_at,
            is_active,
            user_id
          )
        `)
        .eq('is_active', true)
        .eq('is_public', true)
        .order('member_count', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting popular stables:', error);
        return { stables: [], error: error.message };
      }

      // Get current user to determine membership status
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      const stablesWithMemberInfo: StableWithMemberInfo[] = (data || []).map((stable: any) => {
        const userMembership = stable.stable_members?.find((member: any) => 
          member.user_id === currentUserId && member.is_active
        );

        return {
          ...stable,
          stable_members: undefined,
          user_role: userMembership?.role,
          user_joined_at: userMembership?.joined_at,
          is_member: !!userMembership
        };
      });

      return { stables: stablesWithMemberInfo, error: null };
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

      // Check if user has permission to update this stable
      const { data: membership } = await supabase
        .from('stable_members')
        .select('role')
        .eq('stable_id', stableId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return { stable: null, error: 'You do not have permission to update this stable' };
      }

      const { data: stable, error } = await supabase
        .from('stables')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', stableId)
        .select()
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

  // Get countries with stables (for filtering)
  static async getCountriesWithStables(): Promise<{ countries: string[]; error: string | null }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('stables')
        .select('country')
        .eq('is_active', true)
        .eq('is_public', true);

      if (error) {
        console.error('Error getting countries:', error);
        return { countries: [], error: error.message };
      }

      const countries: string[] = [...new Set((data || []).map((item: any) => item.country).filter(Boolean) as string[])].sort();
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
        .eq('is_active', true)
        .eq('is_public', true);

      if (error) {
        console.error('Error getting states:', error);
        return { states: [], error: error.message };
      }

      const states: string[] = [...new Set((data || []).map((item: any) => item.state_province).filter(Boolean) as string[])].sort();
      return { states, error: null };
    } catch (error) {
      console.error('Error in getStatesForCountry:', error);
      return { states: [], error: 'Failed to get states' };
    }
  }
}
