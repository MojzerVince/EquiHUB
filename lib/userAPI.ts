import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  profile_image_url?: string;
  age: number;
  description: string;
  experience?: number;
  is_pro_member?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSearchResult {
  id: string;
  name: string;
  profile_image_url?: string;
  age: number;
  description: string;
  is_pro_member?: boolean;
  is_friend?: boolean;
  is_online?: boolean;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface FriendWithProfile {
  id: string;
  friend_id: string;
  status: string;
  created_at: string;
  friend_profile: UserProfile;
}

export class UserAPI {
  // Search for users by name or email
  static async searchUsers(query: string, currentUserId: string): Promise<{ users: UserSearchResult[]; error: string | null }> {
    try {
      if (!query || query.trim().length < 2) {
        return { users: [], error: null };
      }

      const searchTerm = query.trim().toLowerCase();

      // Search for users by name (case-insensitive)
      const { data: users, error: searchError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          profile_image_url,
          age,
          description,
          is_pro_member
        `)
        .neq('id', currentUserId) // Exclude current user
        .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(10);

      if (searchError) {
        console.error('Search users error:', searchError);
        return { users: [], error: 'Failed to search users' };
      }

      if (!users) {
        return { users: [], error: null };
      }

      // Get friendship status for each user
      const userIds = users.map(user => user.id);
      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id, status')
        .eq('user_id', currentUserId)
        .in('friend_id', userIds);

      // Map friendship status to users
      const usersWithFriendshipStatus: UserSearchResult[] = users.map(user => {
        const friendship = friendships?.find(f => f.friend_id === user.id);
        return {
          ...user,
          is_friend: friendship?.status === 'accepted',
          is_online: false // We'll implement online status later
        };
      });

      return { users: usersWithFriendshipStatus, error: null };

    } catch (error) {
      console.error('Search users error:', error);
      return { users: [], error: 'An unexpected error occurred while searching users' };
    }
  }

  // Get user's friends
  static async getFriends(userId: string): Promise<{ friends: UserSearchResult[]; error: string | null }> {
    try {
      // Get accepted friendships
      const { data: friendships, error: friendshipError } = await supabase
        .from('friendships')
        .select(`
          friend_id,
          friend_profile:profiles!friendships_friend_id_fkey(
            id,
            name,
            profile_image_url,
            age,
            description,
            is_pro_member
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (friendshipError) {
        console.error('Get friends error:', friendshipError);
        return { friends: [], error: 'Failed to get friends' };
      }

      if (!friendships) {
        return { friends: [], error: null };
      }

      // Format friends data
      const friends: UserSearchResult[] = friendships.map((friendship: any) => ({
        id: friendship.friend_profile.id,
        name: friendship.friend_profile.name,
        profile_image_url: friendship.friend_profile.profile_image_url,
        age: friendship.friend_profile.age,
        description: friendship.friend_profile.description,
        is_pro_member: friendship.friend_profile.is_pro_member,
        is_friend: true,
        is_online: false // We'll implement online status later
      }));

      return { friends, error: null };

    } catch (error) {
      console.error('Get friends error:', error);
      return { friends: [], error: 'An unexpected error occurred while getting friends' };
    }
  }

  // Send friend request
  static async sendFriendRequest(userId: string, friendId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      // Check if friendship already exists
      const { data: existingFriendship } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
        .single();

      if (existingFriendship) {
        if (existingFriendship.status === 'accepted') {
          return { success: false, error: 'You are already friends with this user' };
        } else if (existingFriendship.status === 'pending') {
          return { success: false, error: 'Friend request already sent' };
        }
      }

      // Create new friendship
      const { error: insertError } = await supabase
        .from('friendships')
        .insert({
          user_id: userId,
          friend_id: friendId,
          status: 'pending'
        });

      if (insertError) {
        console.error('Send friend request error:', insertError);
        return { success: false, error: 'Failed to send friend request' };
      }

      return { success: true, error: null };

    } catch (error) {
      console.error('Send friend request error:', error);
      return { success: false, error: 'An unexpected error occurred while sending friend request' };
    }
  }

  // Accept friend request
  static async acceptFriendRequest(userId: string, friendId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      // Update friendship status to accepted
      const { error: updateError } = await supabase
        .from('friendships')
        .update({ 
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (updateError) {
        console.error('Accept friend request error:', updateError);
        return { success: false, error: 'Failed to accept friend request' };
      }

      // Create reciprocal friendship
      const { error: reciprocalError } = await supabase
        .from('friendships')
        .insert({
          user_id: userId,
          friend_id: friendId,
          status: 'accepted'
        });

      if (reciprocalError && !reciprocalError.message.includes('duplicate')) {
        console.error('Create reciprocal friendship error:', reciprocalError);
        // Don't fail if reciprocal already exists
      }

      return { success: true, error: null };

    } catch (error) {
      console.error('Accept friend request error:', error);
      return { success: false, error: 'An unexpected error occurred while accepting friend request' };
    }
  }

  // Remove friend
  static async removeFriend(userId: string, friendId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      // Remove both friendship records
      const { error: removeError } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

      if (removeError) {
        console.error('Remove friend error:', removeError);
        return { success: false, error: 'Failed to remove friend' };
      }

      return { success: true, error: null };

    } catch (error) {
      console.error('Remove friend error:', error);
      return { success: false, error: 'An unexpected error occurred while removing friend' };
    }
  }

  // Get user profile by ID
  static async getUserProfile(userId: string): Promise<{ profile: UserProfile | null; error: string | null }> {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Get user profile error:', profileError);
        return { profile: null, error: 'Failed to get user profile' };
      }

      return { profile, error: null };

    } catch (error) {
      console.error('Get user profile error:', error);
      return { profile: null, error: 'An unexpected error occurred while getting user profile' };
    }
  }

  // Get pending friend requests
  static async getPendingFriendRequests(userId: string): Promise<{ requests: UserSearchResult[]; error: string | null }> {
    try {
      const { data: pendingRequests, error: requestError } = await supabase
        .from('friendships')
        .select(`
          user_id,
          user_profile:profiles!friendships_user_id_fkey(
            id,
            name,
            profile_image_url,
            age,
            description,
            is_pro_member
          )
        `)
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (requestError) {
        console.error('Get pending requests error:', requestError);
        return { requests: [], error: 'Failed to get pending friend requests' };
      }

      if (!pendingRequests) {
        return { requests: [], error: null };
      }

      const requests: UserSearchResult[] = pendingRequests.map((request: any) => ({
        id: request.user_profile.id,
        name: request.user_profile.name,
        profile_image_url: request.user_profile.profile_image_url,
        age: request.user_profile.age,
        description: request.user_profile.description,
        is_pro_member: request.user_profile.is_pro_member,
        is_friend: false,
        is_online: false
      }));

      return { requests, error: null };

    } catch (error) {
      console.error('Get pending requests error:', error);
      return { requests: [], error: 'An unexpected error occurred while getting pending friend requests' };
    }
  }
}
