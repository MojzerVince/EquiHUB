import { CommunityPost, PostLike, supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export interface CreatePostData {
  content: string;
  image_url?: string;
  session_data?: {
    horse_name: string;
    duration: string;
    distance: string;
    avg_speed: string;
    session_id?: string;
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
      // Use a timeout to prevent hanging on auth.getSession()
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Auth timeout')), 3000);
      });
      
      const result = await Promise.race([sessionPromise, timeoutPromise]);
      
      let token: string | null = null;
      
      if (result === null) {
        // Reduce log verbosity - only log occasionally
        if (Math.random() < 0.1) { // Log 10% of the time
          console.log('Auth session timed out, using anonymous access');
        }
        token = null;
      } else {
        const { data: { session } } = result as any;
        token = session?.access_token || null;
      }

      // Cache the result
      this.authTokenCache = { token, timestamp: Date.now() };
      return token;
    } catch (error) {
      // Reduce log verbosity for timeout errors
      if (error instanceof Error && error.message.includes('Auth timeout')) {
        // Only log occasionally to reduce spam
        if (Math.random() < 0.1) {
          console.log('Auth timeout, using anonymous access');
        }
      } else {
        console.log('Auth error, falling back to anonymous:', error instanceof Error ? error.message : 'Unknown error');
      }
      
      // Cache null result to avoid repeated failures
      this.authTokenCache = { token: null, timestamp: Date.now() };
      return null;
    }
  }

  // Helper method to make authenticated requests
  private static async makeRequest(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    try {
      const token = await this.getAuthToken();
      
      const headers: Record<string, string> = {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      // Use the user's JWT token if available, otherwise fall back to anon key
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
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
}
