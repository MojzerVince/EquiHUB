import { CommunityPost, PostLike, getSupabase, getSupabaseConfig } from './supabase';

export interface CreatePostData {
  content: string;
  image_url?: string;
  image_base64?: string;
  session_data?: {
    horse_name: string;
    duration: string;
    distance: string;
    avg_speed: string;
    session_id?: string;
    horse_image_url?: string;
    path?: Array<{
      latitude: number;
      longitude: number;
      timestamp: number;
      accuracy?: number;
      speed?: number;
    }>;
    path_enabled?: boolean;
  };
}

export interface PostWithUser extends CommunityPost {
  profiles: {
    id: string;
    name: string;
    profile_image_url?: string;
  };
  is_liked?: boolean;
  user_likes?: PostLike[];
}

export class CommunityAPI {
  // Cache for auth token to avoid multiple simultaneous calls
  private static authTokenCache: { token: string | null; timestamp: number } | null = null;
  private static readonly TOKEN_CACHE_DURATION = 30000; // 30 seconds

  // Helper method to get auth token with caching
  private static async getAuthToken(): Promise<string | null> {
    // Check cache first
    if (this.authTokenCache && Date.now() - this.authTokenCache.timestamp < this.TOKEN_CACHE_DURATION) {
      return this.authTokenCache.token;
    }

    try {
      console.log('🔗 Getting auth token via direct session with extended timeout...');
      
      // Get the initialized Supabase client
      const supabase = getSupabase();
      
      // Try to get session with a much longer timeout (10 seconds)
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Auth timeout after 10 seconds')), 10000);
      });
      
      const result = await Promise.race([sessionPromise, timeoutPromise]);
      
      let token: string | null = null;
      
      if (result === null) {
        console.log('⏱️ Auth session timed out');
        token = null;
      } else {
        const { data: { session } } = result as any;
        token = session?.access_token || null;
        console.log('� Got auth token from session:', !!token);
      }

      // Cache the result
      this.authTokenCache = { token, timestamp: Date.now() };
      return token;

    } catch (error) {
      console.log('❌ Auth error:', error instanceof Error ? error.message : 'Unknown error');
      
      // Cache null result to avoid repeated failures
      this.authTokenCache = { token: null, timestamp: Date.now() };
      return null;
    }
  }

  // Helper method to make authenticated requests
  private static async makeRequest(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: any,
    authToken?: string
  ): Promise<any> {
    try {
      const token = authToken || await this.getAuthToken();
      
      // Get secure configuration
      const config = getSupabaseConfig();
      
      const headers: Record<string, string> = {
        'apikey': config.anonKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      // Add Authorization header only if we have a valid user token
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.warn('⚠️ No auth token available - request will be anonymous');
      }

      const response = await fetch(`${config.url}/rest/v1/${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Request error:', error);
      throw error;
    }
  }

  // Create a new post
  static async createPost(userId: string, postData: CreatePostData): Promise<{ post: CommunityPost | null; error: string | null }> {
    try {
      const token = await this.getAuthToken();
      
      const postBody = {
        user_id: userId,
        content: postData.content,
        image_url: postData.image_url,
        image_base64: postData.image_base64,
        session_data: postData.session_data,
        likes_count: 0,
      };

      const data = await this.makeRequest('community_posts', 'POST', postBody);
      
      // REST API returns an array, get the first item
      const post = Array.isArray(data) ? data[0] : data;
      
      return { post, error: null };
    } catch (error) {
      console.error('Create post error:', error);
      return { post: null, error: 'Failed to create post' };
    }
  }

  // Get posts from friends and own posts
  static async getFeedPosts(userId: string): Promise<{ posts: PostWithUser[]; error: string | null }> {
    try {
      // First get user's friends using REST API
      const friendshipsData = await this.makeRequest(
        `friendships?or=(user_id.eq.${userId},friend_id.eq.${userId})&status=eq.accepted&select=friend_id,user_id`
      );

      // Extract friend IDs
      const friendIds = new Set<string>();
      
      if (friendshipsData && Array.isArray(friendshipsData)) {
        friendshipsData.forEach((friendship: any) => {
          if (friendship.user_id === userId) {
            friendIds.add(friendship.friend_id);
          } else {
            friendIds.add(friendship.user_id);
          }
        });
      }

      // Add current user to see their own posts
      friendIds.add(userId);
      const userIds = Array.from(friendIds);

      // Get posts from friends and current user using REST API
      const userIdsQuery = userIds.map(id => `user_id.eq.${id}`).join(',');
      const postsData = await this.makeRequest(
        `community_posts?or=(${userIdsQuery})&select=*,profiles!community_posts_user_id_fkey(id,name,profile_image_url)&order=created_at.desc`
      );

      // Get likes for current user on these posts
      let userLikes: any[] = [];
      if (postsData && Array.isArray(postsData) && postsData.length > 0) {
        const postIds = postsData.map((post: any) => post.id);
        const postIdsQuery = postIds.map(id => `post_id.eq.${id}`).join(',');
        
        userLikes = await this.makeRequest(
          `post_likes?user_id=eq.${userId}&or=(${postIdsQuery})&select=id,user_id,post_id`
        );
      }

      // Process posts to add is_liked flag
      const processedPosts: PostWithUser[] = (postsData || []).map((post: any) => ({
        ...post,
        is_liked: userLikes?.some((like: any) => like.post_id === post.id) || false,
        user_likes: userLikes?.filter((like: any) => like.post_id === post.id) || []
      }));

      return { posts: processedPosts, error: null };
    } catch (error) {
      console.error('Get feed posts error:', error);
      return { posts: [], error: 'An unexpected error occurred while getting posts' };
    }
  }

  // Like/unlike a post
  static async togglePostLike(postId: string, userId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      // Check if user already liked the post using REST API
      const existingLikes = await this.makeRequest(
        `post_likes?post_id=eq.${postId}&user_id=eq.${userId}&select=id`
      );

      const hasExistingLike = existingLikes && Array.isArray(existingLikes) && existingLikes.length > 0;

      if (hasExistingLike) {
        // Unlike the post
        const likeId = existingLikes[0].id;
        await this.makeRequest(`post_likes?id=eq.${likeId}`, 'DELETE');

        // Decrease likes count
        const currentPosts = await this.makeRequest(
          `community_posts?id=eq.${postId}&select=likes_count`
        );

        if (currentPosts && Array.isArray(currentPosts) && currentPosts.length > 0) {
          const currentPost = currentPosts[0];
          await this.makeRequest(
            `community_posts?id=eq.${postId}`,
            'PATCH',
            { likes_count: Math.max(0, currentPost.likes_count - 1) }
          );
        }
      } else {
        // Like the post
        await this.makeRequest('post_likes', 'POST', {
          post_id: postId,
          user_id: userId,
        });

        // Increase likes count
        const currentPosts = await this.makeRequest(
          `community_posts?id=eq.${postId}&select=likes_count`
        );

        if (currentPosts && Array.isArray(currentPosts) && currentPosts.length > 0) {
          const currentPost = currentPosts[0];
          await this.makeRequest(
            `community_posts?id=eq.${postId}`,
            'PATCH',
            { likes_count: currentPost.likes_count + 1 }
          );
        }
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Toggle like error:', error);
      return { success: false, error: 'An unexpected error occurred while toggling like' };
    }
  }

  // Delete a post (only by post owner)
  static async deletePost(postId: string, userId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      await this.makeRequest(`community_posts?id=eq.${postId}&user_id=eq.${userId}`, 'DELETE');
      return { success: true, error: null };
    } catch (error) {
      console.error('Delete post error:', error);
      return { success: false, error: 'An unexpected error occurred while deleting the post' };
    }
  }

  // Send friend request using REST API
  static async sendFriendRequest(userId: string, friendId: string, authToken?: string): Promise<{ success: boolean; error: string | null }> {
    try {
      console.log('🔗 CommunityAPI.sendFriendRequest - Using REST API');
      console.log('👤 Sender ID:', userId);
      console.log('👥 Recipient ID:', friendId);

      // Use provided auth token or try to get one (but don't fail if we can't)
      let token = authToken;
      if (!token) {
        const retrievedToken = await this.getAuthToken();
        token = retrievedToken || undefined;
        console.log('🔑 Auth token available:', !!token);
      } else {
        console.log('🔑 Using provided auth token');
      }

      if (!token) {
        console.error('❌ No authentication token - friend requests require authentication');
        return { success: false, error: 'Authentication required. Please log in again.' };
      }

      // Check if friendship already exists
      const existingFriendship = await this.makeRequest(
        `friendships?or=(and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId}))&select=id,status`,
        'GET',
        undefined,
        token
      );

      console.log('🔍 Existing friendship check result:', existingFriendship);

      if (existingFriendship && Array.isArray(existingFriendship) && existingFriendship.length > 0) {
        const existing = existingFriendship[0];
        if (existing.status === 'accepted') {
          console.log('❌ Already friends');
          return { success: false, error: 'You are already friends with this user' };
        } else if (existing.status === 'pending') {
          console.log('❌ Friend request already pending');
          return { success: false, error: 'Friend request already sent' };
        }
      }

      // Create new friendship
      console.log('📤 Creating new friendship...');
      const newFriendship = await this.makeRequest(
        'friendships',
        'POST',
        {
          user_id: userId,
          friend_id: friendId,
          status: 'pending'
        },
        token
      );

      console.log('✅ Friendship created:', newFriendship);
      return { success: true, error: null };

    } catch (error) {
      console.error('💥 Send friend request error:', error);
      return { success: false, error: 'An unexpected error occurred while sending friend request' };
    }
  }

  // Accept friend request using REST API
  static async acceptFriendRequest(userId: string, friendId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      console.log('🔗 CommunityAPI.acceptFriendRequest - Using REST API');
      console.log('👤 User ID (receiver):', userId);
      console.log('👥 Friend ID (sender):', friendId);
      
      // Update friendship status to accepted with proper WHERE clause
      await this.makeRequest(
        `friendships?user_id=eq.${friendId}&friend_id=eq.${userId}&status=eq.pending`,
        'PATCH',
        { status: 'accepted' }
      );

      console.log('✅ Friend request accepted, now creating reciprocal friendship...');

      // Create reciprocal friendship record
      try {
        await this.makeRequest(
          'friendships',
          'POST',
          {
            user_id: userId,
            friend_id: friendId,
            status: 'accepted'
          }
        );
        console.log('✅ Reciprocal friendship created successfully');
      } catch (reciprocalError) {
        // Check if it's a duplicate key error (which is expected if reciprocal already exists)
        console.log('⚠️ Reciprocal friendship creation result:', reciprocalError);
        // Don't fail the whole operation if reciprocal creation fails due to duplicate
        if (!String(reciprocalError).includes('duplicate') && !String(reciprocalError).includes('unique')) {
          console.error('❌ Unexpected error creating reciprocal friendship:', reciprocalError);
          // Don't throw error, but log it - the main friendship is already accepted
        }
      }

      console.log('✅ Friend request acceptance complete');
      return { success: true, error: null };

    } catch (error) {
      console.error('💥 Accept friend request error:', error);
      return { success: false, error: 'An unexpected error occurred while accepting friend request' };
    }
  }

  // Get pending friend requests using REST API
  static async getPendingFriendRequests(userId: string): Promise<{ requests: any[]; error: string | null }> {
    try {
      console.log('🔗 CommunityAPI.getPendingFriendRequests - Using REST API for user:', userId);
      
      // First, get the basic friend requests
      const requests = await this.makeRequest(
        `friendships?friend_id=eq.${userId}&status=eq.pending&select=id,user_id,friend_id,status,created_at`
      );

      console.log('📨 Raw friend requests result:', requests);

      if (!requests || requests.length === 0) {
        console.log('📭 No pending friend requests found');
        return { requests: [], error: null };
      }

      // Now get the sender profiles separately
      const processedRequests = [];
      for (const request of requests) {
        try {
          // Get the sender's profile information
          const senderProfile = await this.makeRequest(
            `profiles?id=eq.${request.user_id}&select=id,name,profile_image_url`
          );
          
          const sender = senderProfile && senderProfile.length > 0 ? senderProfile[0] : null;
          
          processedRequests.push({
            ...request,
            sender_name: sender?.name || 'Unknown User',
            sender_avatar: sender?.profile_image_url || null
          });
        } catch (profileError) {
          console.error('❌ Error fetching sender profile for request:', request.id, profileError);
          // Still include the request but with unknown sender
          processedRequests.push({
            ...request,
            sender_name: 'Unknown User',
            sender_avatar: null
          });
        }
      }

      console.log('📋 Processed friend requests:', processedRequests);
      return { requests: processedRequests, error: null };

    } catch (error) {
      console.error('💥 Get friend requests error:', error);
      return { requests: [], error: 'An unexpected error occurred while loading friend requests' };
    }
  }

  // Report a post
  static async reportPost(postId: string, userId: string, reason: string): Promise<{ success: boolean; error: string | null }> {
    try {
      console.log('🚨 CommunityAPI.reportPost - Reporting post:', postId);
      
      // Check if user already reported this post
      const existingReport = await this.makeRequest(
        `post_reports?post_id=eq.${postId}&reporter_id=eq.${userId}&select=id`
      );

      if (existingReport && Array.isArray(existingReport) && existingReport.length > 0) {
        return { success: false, error: 'You have already reported this post' };
      }

      // Create new report
      await this.makeRequest(
        'post_reports',
        'POST',
        {
          post_id: postId,
          reporter_id: userId,
          reason: reason,
          status: 'pending'
        }
      );

      console.log('✅ Post reported successfully');
      return { success: true, error: null };

    } catch (error) {
      console.error('💥 Report post error:', error);
      return { success: false, error: 'An unexpected error occurred while reporting the post' };
    }
  }
}
