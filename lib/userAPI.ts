import { getSupabase, getSupabaseConfig } from './supabase';

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
  // Get friends count only - lightweight API call that returns just an integer
  static async getFriendsCount(userId: string): Promise<number> {
    try {
      console.log("📊 UserAPI.getFriendsCount: Getting friends count for user:", userId);
      
      const supabase = getSupabase();
      
      // Use count query to get only the number, not the actual data
      const { count, error } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');
      
      if (error) {
        console.error("❌ UserAPI.getFriendsCount: Database error:", error);
        return 0;
      }
      
      const friendsCount = count || 0;
      console.log(`📊 UserAPI.getFriendsCount: Friends count for user ${userId}: ${friendsCount}`);
      return friendsCount;
    } catch (error) {
      console.error("💥 UserAPI.getFriendsCount: Exception:", error);
      return 0;
    }
  }

  // Diagnose friendship records for a user (debugging function)
  static async diagnoseFriendships(userId: string): Promise<{ 
    allRecords: any[], 
    asUser: any[], 
    asFriend: any[], 
    reciprocalIssues: string[],
    error: string | null 
  }> {
    try {
      console.log("🔍 UserAPI.diagnoseFriendships: Diagnosing friendships for user:", userId);
      
      const supabase = getSupabase();
      
      // Get all friendship records involving this user
      const { data: allRecords, error } = await supabase
        .from('friendships')
        .select('id, user_id, friend_id, status, created_at')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted')
        .order('created_at', { ascending: true });

      if (error) {
        console.error("❌ UserAPI.diagnoseFriendships: Database error:", error);
        return { allRecords: [], asUser: [], asFriend: [], reciprocalIssues: [], error: error.message };
      }

      if (!allRecords || allRecords.length === 0) {
        console.log("ℹ️ UserAPI.diagnoseFriendships: No friendship records found");
        return { allRecords: [], asUser: [], asFriend: [], reciprocalIssues: [], error: null };
      }

      // Separate records where user is the user_id vs friend_id
      const asUser = allRecords.filter((r: any) => r.user_id === userId);
      const asFriend = allRecords.filter((r: any) => r.friend_id === userId);

      console.log("📊 UserAPI.diagnoseFriendships: Analysis:");
      console.log("  - Total records:", allRecords.length);
      console.log("  - As user_id:", asUser.length);
      console.log("  - As friend_id:", asFriend.length);
      console.log("  - Records where user is user_id:", asUser.map((r: any) => `${r.user_id} -> ${r.friend_id}`));
      console.log("  - Records where user is friend_id:", asFriend.map((r: any) => `${r.user_id} -> ${r.friend_id}`));

      // Check for reciprocal issues
      const reciprocalIssues: string[] = [];
      
      // For each record where user is user_id, check if reciprocal exists
      for (const record of asUser) {
        const reciprocalExists = asFriend.some((r: any) => r.user_id === record.friend_id);
        if (!reciprocalExists) {
          reciprocalIssues.push(`Missing reciprocal for ${record.user_id} -> ${record.friend_id}`);
        }
      }

      // For each record where user is friend_id, check if reciprocal exists  
      for (const record of asFriend) {
        const reciprocalExists = asUser.some((r: any) => r.friend_id === record.user_id);
        if (!reciprocalExists) {
          reciprocalIssues.push(`Missing reciprocal for ${record.user_id} -> ${record.friend_id}`);
        }
      }

      console.log("🚨 UserAPI.diagnoseFriendships: Reciprocal issues:", reciprocalIssues);

      return { 
        allRecords, 
        asUser, 
        asFriend, 
        reciprocalIssues,
        error: null 
      };

    } catch (error) {
      console.error("💥 UserAPI.diagnoseFriendships: Exception:", error);
      return { 
        allRecords: [], 
        asUser: [], 
        asFriend: [], 
        reciprocalIssues: [], 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Fix broken friendships by creating missing reciprocal records
  static async fixBrokenFriendships(userId: string): Promise<{ 
    fixed: number, 
    errors: string[], 
    error: string | null 
  }> {
    try {
      console.log("🔧 UserAPI.fixBrokenFriendships: Fixing broken friendships for user:", userId);
      
      // First diagnose the issues
      const diagnosis = await this.diagnoseFriendships(userId);
      
      if (diagnosis.error) {
        return { fixed: 0, errors: [diagnosis.error], error: diagnosis.error };
      }

      if (diagnosis.reciprocalIssues.length === 0) {
        console.log("✅ UserAPI.fixBrokenFriendships: No broken friendships found");
        return { fixed: 0, errors: [], error: null };
      }

      console.log("🔧 UserAPI.fixBrokenFriendships: Found", diagnosis.reciprocalIssues.length, "issues to fix");

      const supabase = getSupabase();
      let fixed = 0;
      const errors: string[] = [];

      // Create missing reciprocal records
      for (const record of diagnosis.asUser) {
        const reciprocalExists = diagnosis.asFriend.some((r: any) => r.user_id === record.friend_id);
        if (!reciprocalExists) {
          try {
            console.log(`🔧 Creating reciprocal record: ${record.friend_id} -> ${record.user_id}`);
            
            const { error: insertError } = await supabase
              .from('friendships')
              .insert({
                user_id: record.friend_id,
                friend_id: record.user_id,
                status: 'accepted',
                created_at: new Date().toISOString()
              });

            if (insertError) {
              if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
                console.log("ℹ️ Reciprocal record already exists, skipping");
              } else {
                console.error("❌ Error creating reciprocal record:", insertError);
                errors.push(`Failed to create reciprocal for ${record.friend_id} -> ${record.user_id}: ${insertError.message}`);
              }
            } else {
              console.log("✅ Reciprocal record created successfully");
              fixed++;
            }
          } catch (error) {
            console.error("💥 Exception creating reciprocal record:", error);
            errors.push(`Exception creating reciprocal for ${record.friend_id} -> ${record.user_id}: ${error}`);
          }
        }
      }

      // Create missing reciprocal records for the other direction
      for (const record of diagnosis.asFriend) {
        const reciprocalExists = diagnosis.asUser.some((r: any) => r.friend_id === record.user_id);
        if (!reciprocalExists) {
          try {
            console.log(`🔧 Creating reciprocal record: ${record.friend_id} -> ${record.user_id}`);
            
            const { error: insertError } = await supabase
              .from('friendships')
              .insert({
                user_id: record.friend_id,
                friend_id: record.user_id,
                status: 'accepted',
                created_at: new Date().toISOString()
              });

            if (insertError) {
              if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
                console.log("ℹ️ Reciprocal record already exists, skipping");
              } else {
                console.error("❌ Error creating reciprocal record:", insertError);
                errors.push(`Failed to create reciprocal for ${record.friend_id} -> ${record.user_id}: ${insertError.message}`);
              }
            } else {
              console.log("✅ Reciprocal record created successfully");
              fixed++;
            }
          } catch (error) {
            console.error("💥 Exception creating reciprocal record:", error);
            errors.push(`Exception creating reciprocal for ${record.friend_id} -> ${record.user_id}: ${error}`);
          }
        }
      }

      console.log(`🎉 UserAPI.fixBrokenFriendships: Fixed ${fixed} broken friendships`);
      if (errors.length > 0) {
        console.log("⚠️ UserAPI.fixBrokenFriendships: Errors encountered:", errors);
      }

      return { fixed, errors, error: null };

    } catch (error) {
      console.error("💥 UserAPI.fixBrokenFriendships: Exception:", error);
      return { 
        fixed: 0, 
        errors: [], 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Test database connection and table access
  static async testDatabaseConnection(): Promise<{ success: boolean; error: string | null; data?: any }> {
    try {
      console.log("🧪 UserAPI.testDatabaseConnection: Testing database connection");
      
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
      // Test basic connection with a simple query
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .limit(1);

      console.log("📥 UserAPI.testDatabaseConnection: Response received");
      console.log("  - Error:", error);
      //console.log("  - Data:", data);

      if (error) {
        console.error('❌ UserAPI.testDatabaseConnection: Database error:', error);
        return { 
          success: false, 
          error: `Database error: ${error.message}`,
          data: { error: error }
        };
      }

      console.log("✅ UserAPI.testDatabaseConnection: Connection successful");
      return { 
        success: true, 
        error: null,
        data: { profiles: data, count: data?.length || 0 }
      };

    } catch (error) {
      console.error('💥 UserAPI.testDatabaseConnection: Exception caught:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        data: { exception: error }
      };
    }
  }

  // Alternative search using direct REST API
  static async searchUsersDirectAPI(query: string, currentUserId: string): Promise<{ users: UserSearchResult[]; error: string | null }> {
    try {
      console.log("🌐 UserAPI.searchUsersDirectAPI: Starting direct REST API search");
      //console.log("  - Query:", `"${query}"`);
      console.log("  - Current user ID:", currentUserId);
      
      if (!query || query.trim().length < 2) {
        console.log("⏹️ UserAPI.searchUsersDirectAPI: Query too short or empty");
        return { users: [], error: null };
      }

      const searchTerm = query.trim();
      console.log("  - Search term processed:", `"${searchTerm}"`);

      // Get secure configuration
      const config = getSupabaseConfig();
      
      // Construct direct REST API URL with proper query parameter
      const url = `${config.url}/rest/v1/profiles?select=id,name,profile_image_url,age,description,is_pro_member&id=neq.${currentUserId}&name=ilike.*${encodeURIComponent(searchTerm)}*&limit=10`;
      
      console.log("📡 UserAPI.searchUsersDirectAPI: Making direct REST API call");
      console.log("  - URL:", url);
      
      const apiStartTime = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      });

      const apiEndTime = Date.now();
      console.log(`📥 UserAPI.searchUsersDirectAPI: REST API response received (${apiEndTime - apiStartTime}ms)`);
      console.log("  - Status:", response.status);
      console.log("  - Status text:", response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ UserAPI.searchUsersDirectAPI: HTTP Error');
        console.error('  - Status:', response.status);
        console.error('  - Error text:', errorText);
        return { users: [], error: `HTTP Error: ${response.status} - ${errorText}` };
      }

      const users = await response.json();
      console.log("📊 UserAPI.searchUsersDirectAPI: Raw users data received");
      console.log("  - Users found:", users?.length || 0);
      
      // Log essential user info only (no base64 data)
      if (users && users.length > 0) {
        console.log("📋 UserAPI.searchUsersDirectAPI: Found users:");
        users.forEach((user: any, index: number) => {
          console.log(`  ${index + 1}. Name: ${user.name}`);
          console.log(`     Age: ${user.age}`);
          console.log(`     Description: ${user.description || 'No description'}`);
          console.log(`     Pro member: ${user.is_pro_member ? 'Yes' : 'No'}`);
          //console.log(`     Has profile_image_url: ${user.profile_image_url ? 'Yes' : 'No'}`);
          console.log("     ---");
        });
      }

      if (!users || users.length === 0) {
        console.log("⚠️ UserAPI.searchUsersDirectAPI: No users found for query");
        return { users: [], error: null };
      }

      console.log("🔍 UserAPI.searchUsersDirectAPI: Getting friendship status for found users");
      const userIds = users.map((user: any) => user.id);
      console.log("  - User IDs to check friendship status:", userIds);
      
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
      // Check friendship status for found users
      const { data: friendships, error: friendshipError } = await supabase
        .from('friendships')
        .select('friend_id, status')
        .eq('user_id', currentUserId)
        .in('friend_id', userIds);

      console.log("📥 UserAPI.searchUsersDirectAPI: Friendship status received");
      console.log("  - Friendship error:", friendshipError);
      console.log("  - Friendships found:", friendships?.length || 0);

      if (friendshipError) {
        console.warn('⚠️ UserAPI.searchUsersDirectAPI: Friendship check failed, continuing without status');
        console.warn('  - Friendship error:', friendshipError);
      }

      // Map users with proper friendship status
      const usersWithFriendshipStatus: UserSearchResult[] = users.map((user: any) => {
        const friendship = friendships?.find((f: any) => f.friend_id === user.id);
        const result = {
          id: user.id,
          name: user.name,
          profile_image_url: user.profile_image_url,
          age: user.age,
          description: user.description,
          is_pro_member: user.is_pro_member,
          is_friend: friendship?.status === 'accepted',
          is_online: false
        };
        console.log(`  ✅ Mapped user: ${user.name} (${user.id}) - is_friend: ${result.is_friend}`);
        return result;
      });

      console.log("✅ UserAPI.searchUsersDirectAPI: Search completed successfully");
      console.log("  - Final results count:", usersWithFriendshipStatus.length);
      return { users: usersWithFriendshipStatus, error: null };

    } catch (error) {
      console.error('💥 UserAPI.searchUsersDirectAPI: Exception caught:', error);
      console.error("  - Error type:", typeof error);
      console.error("  - Error message:", error instanceof Error ? error.message : 'Unknown error');
      return { users: [], error: 'An unexpected error occurred while searching users' };
    }
  }

  // Search for users by name or email
  static async searchUsers(query: string, currentUserId: string): Promise<{ users: UserSearchResult[]; error: string | null }> {
    try {
      console.log("🔧 UserAPI.searchUsers: Starting search with REST API");
      console.log("  - Query:", `"${query}"`);
      console.log("  - Current user ID:", currentUserId);
      
      if (!query || query.trim().length < 2) {
        console.log("⏹️ UserAPI.searchUsers: Query too short or empty");
        return { users: [], error: null };
      }

      const searchTerm = query.trim();
      console.log("  - Search term processed:", `"${searchTerm}"`);

      console.log("📡 UserAPI.searchUsers: Making direct REST API query");
      
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
      // Use a simpler approach: search by name only with ilike
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
        .neq('id', currentUserId)
        .ilike('name', `%${searchTerm}%`)
        .limit(10);

      console.log("📥 UserAPI.searchUsers: REST API response received");
      console.log("  - Search error:", searchError);
      console.log("  - Raw response data:", JSON.stringify(users, null, 2));
      console.log("  - Users found:", users?.length || 0);

      if (searchError) {
        console.error('❌ UserAPI.searchUsers: Search error:', searchError);
        console.error('  - Error code:', searchError.code);
        console.error('  - Error details:', searchError.details);
        console.error('  - Error hint:', searchError.hint);
        console.error('  - Error message:', searchError.message);
        return { users: [], error: `Database error: ${searchError.message}` };
      }

      if (!users || users.length === 0) {
        console.log("⚠️ UserAPI.searchUsers: No users found for query");
        return { users: [], error: null };
      }

      console.log("🔍 UserAPI.searchUsers: Getting friendship status for found users");
      const userIds = users.map((user: any) => user.id);
      console.log("  - User IDs to check friendship status:", userIds);
      
      // Check friendship status for found users
      const { data: friendships, error: friendshipError } = await supabase
        .from('friendships')
        .select('friend_id, status')
        .eq('user_id', currentUserId)
        .in('friend_id', userIds);

      console.log("📥 UserAPI.searchUsers: Friendship status received");
      console.log("  - Friendship error:", friendshipError);
      console.log("  - Friendships found:", friendships?.length || 0);
      console.log("  - Friendships data:", JSON.stringify(friendships, null, 2));

      if (friendshipError) {
        console.warn('⚠️ UserAPI.searchUsers: Friendship check failed, continuing without status');
        console.warn('  - Friendship error:', friendshipError);
      }

      // Map friendship status to users
      const usersWithFriendshipStatus: UserSearchResult[] = users.map((user: any) => {
        const friendship = friendships?.find((f: any) => f.friend_id === user.id);
        const result = {
          id: user.id,
          name: user.name,
          profile_image_url: user.profile_image_url,
          age: user.age,
          description: user.description,
          is_pro_member: user.is_pro_member,
          is_friend: friendship?.status === 'accepted',
          is_online: false // We'll implement online status later
        };
        console.log(`  - User ${user.name} (${user.id}): is_friend = ${result.is_friend}`);
        return result;
      });

      console.log("✅ UserAPI.searchUsers: Search completed successfully");
      console.log("  - Final results count:", usersWithFriendshipStatus.length);
      console.log("  - Final results:", JSON.stringify(usersWithFriendshipStatus, null, 2));
      return { users: usersWithFriendshipStatus, error: null };

    } catch (error) {
      console.error('💥 UserAPI.searchUsers: Exception caught:', error);
      console.error("  - Error type:", typeof error);
      console.error("  - Error message:", error instanceof Error ? error.message : 'Unknown error');
      console.error("  - Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      return { users: [], error: 'An unexpected error occurred while searching users' };
    }
  }

  // Get user's friends
  static async getFriends(userId: string): Promise<{ friends: UserSearchResult[]; error: string | null }> {
    try {
      console.log("📊 UserAPI.getFriends: Starting friends query for user:", userId);
      
      // Get the initialized Supabase client
      const supabase = getSupabase();

      // First, try to fix any broken friendships silently
      try {
        console.log("🔧 UserAPI.getFriends: Checking for broken friendships...");
        const fixResult = await this.fixBrokenFriendships(userId);
        if (fixResult.fixed > 0) {
          console.log(`✅ UserAPI.getFriends: Fixed ${fixResult.fixed} broken friendships`);
        }
      } catch (fixError) {
        console.warn("⚠️ UserAPI.getFriends: Failed to fix broken friendships, continuing anyway:", fixError);
      }
      
      // Try the complex join query first (likely to fail due to foreign key issues)
      let { data: friendships, error: friendshipError } = await supabase
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

      // Always use the simpler approach since foreign key joins are problematic
      if (friendshipError || !friendships) {
        console.log("🔄 UserAPI.getFriends: Using simple query approach...");
        if (friendshipError) {
          console.log("  - Error code:", friendshipError.code);
          console.log("  - Error message:", friendshipError.message);
        }
        
        // Get friendships where user is either user_id OR friend_id (bidirectional search)
        const { data: simpleFriendships, error: simpleError } = await supabase
          .from('friendships')
          .select('user_id, friend_id')
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
          .eq('status', 'accepted');
        
        console.log("📥 UserAPI.getFriends: Bidirectional friendships query result:");
        console.log("  - Error:", simpleError);
        console.log("  - Data count:", simpleFriendships?.length || 0);
        console.log("  - Raw data:", simpleFriendships);
        
        if (simpleError) {
          friendshipError = simpleError;
          friendships = null;
        } else if (simpleFriendships && simpleFriendships.length > 0) {
          console.log("🔄 UserAPI.getFriends: Getting profiles for friend IDs...");
          
          // Extract friend IDs - if user is user_id, take friend_id; if user is friend_id, take user_id
          const friendIds = simpleFriendships.map((f: any) => {
            const friendId = f.user_id === userId ? f.friend_id : f.user_id;
            console.log(`  - Processing friendship: user_id=${f.user_id}, friend_id=${f.friend_id}, extracted=${friendId}`);
            return friendId;
          });
          
          // Remove duplicates
          const uniqueFriendIds = [...new Set(friendIds)];
          console.log("  - All Friend IDs:", friendIds);
          console.log("  - Unique Friend IDs:", uniqueFriendIds);
          console.log("  - Duplicates removed:", friendIds.length - uniqueFriendIds.length);
          
          if (uniqueFriendIds.length > 0) {
            const { data: profiles, error: profileError } = await supabase
              .from('profiles')
              .select('id, name, profile_image_url, age, description, is_pro_member')
              .in('id', uniqueFriendIds);
            
            console.log("📥 UserAPI.getFriends: Profiles query result:");
            console.log("  - Error:", profileError);
            console.log("  - Data count:", profiles?.length || 0);
            
            if (profileError) {
              friendshipError = profileError;
              friendships = null;
            } else {
              // Combine the data manually
              friendships = profiles?.map((profile: any) => ({
                friend_id: profile.id,
                friend_profile: profile
              })) || [];
              friendshipError = null;
              console.log("✅ UserAPI.getFriends: Successfully combined data using bidirectional fallback method");
            }
          } else {
            console.log("ℹ️ UserAPI.getFriends: No valid friend IDs found");
            friendships = [];
            friendshipError = null;
          }
        } else {
          console.log("ℹ️ UserAPI.getFriends: No friendships found using bidirectional query");
          friendships = [];
          friendshipError = null;
        }
      }

      console.log("📥 UserAPI.getFriends: Query result:");
      console.log("  - Error:", friendshipError);
      console.log("  - Data count:", friendships?.length || 0);

      if (friendshipError) {
        console.error("❌ UserAPI.getFriends: Database error:", friendshipError);
        console.error("  - Error code:", friendshipError.code);
        console.error("  - Error message:", friendshipError.message);
        console.error("  - Error details:", friendshipError.details);
        
        // Check for specific error types
        if (friendshipError.code === '42P01') {
          return { friends: [], error: 'Friendships table does not exist' };
        } else if (friendshipError.code === '42703') {
          return { friends: [], error: 'Database column does not exist' };
        } else if (friendshipError.message?.includes('RLS')) {
          return { friends: [], error: 'Permission denied - check database permissions' };
        }
        
        return { friends: [], error: `Database error: ${friendshipError.message}` };
      }

      if (!friendships || friendships.length === 0) {
        console.log("ℹ️ UserAPI.getFriends: No friends found (this is normal for new users)");
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

      console.log("✅ UserAPI.getFriends: Successfully loaded", friends.length, "friends");
      return { friends, error: null };

    } catch (error) {
      console.error("💥 UserAPI.getFriends: Exception:", error);
      return { friends: [], error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  // Send friend request
  static async sendFriendRequest(userId: string, friendId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
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
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
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
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
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
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
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
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
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
