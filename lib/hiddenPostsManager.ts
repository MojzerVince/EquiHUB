import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HiddenPost {
  id: string;
  hiddenAt: string;
  authorName: string;
  content: string;
}

export class HiddenPostsManager {
  private static readonly STORAGE_KEY = 'equihub_hidden_posts';

  // Get all hidden posts for a user
  static async getHiddenPosts(userId: string): Promise<HiddenPost[]> {
    try {
      const key = `${this.STORAGE_KEY}_${userId}`;
      const hiddenPostsJson = await AsyncStorage.getItem(key);
      
      if (!hiddenPostsJson) {
        return [];
      }

      const hiddenPosts = JSON.parse(hiddenPostsJson);
      return Array.isArray(hiddenPosts) ? hiddenPosts : [];
    } catch (error) {
      console.error('Error getting hidden posts:', error);
      return [];
    }
  }

  // Get just the post IDs that are hidden
  static async getHiddenPostIds(userId: string): Promise<string[]> {
    try {
      const hiddenPosts = await this.getHiddenPosts(userId);
      return hiddenPosts.map(post => post.id);
    } catch (error) {
      console.error('Error getting hidden post IDs:', error);
      return [];
    }
  }

  // Hide a post
  static async hidePost(userId: string, postId: string, authorName: string, content: string): Promise<boolean> {
    try {
      const hiddenPosts = await this.getHiddenPosts(userId);
      
      // Check if post is already hidden
      if (hiddenPosts.some(post => post.id === postId)) {
        return true; // Already hidden
      }

      // Add new hidden post
      const newHiddenPost: HiddenPost = {
        id: postId,
        hiddenAt: new Date().toISOString(),
        authorName,
        content: content.length > 100 ? content.substring(0, 100) + '...' : content
      };

      hiddenPosts.push(newHiddenPost);

      const key = `${this.STORAGE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(hiddenPosts));
      
      return true;
    } catch (error) {
      console.error('Error hiding post:', error);
      return false;
    }
  }

  // Unhide a post
  static async unhidePost(userId: string, postId: string): Promise<boolean> {
    try {
      const hiddenPosts = await this.getHiddenPosts(userId);
      const updatedHiddenPosts = hiddenPosts.filter(post => post.id !== postId);

      const key = `${this.STORAGE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedHiddenPosts));
      
      console.log('✅ Post unhidden successfully:', postId);
      return true;
    } catch (error) {
      console.error('Error unhiding post:', error);
      return false;
    }
  }

  // Check if a post is hidden
  static async isPostHidden(userId: string, postId: string): Promise<boolean> {
    try {
      const hiddenPostIds = await this.getHiddenPostIds(userId);
      return hiddenPostIds.includes(postId);
    } catch (error) {
      console.error('Error checking if post is hidden:', error);
      return false;
    }
  }

  // Clear all hidden posts for a user
  static async clearAllHiddenPosts(userId: string): Promise<boolean> {
    try {
      const key = `${this.STORAGE_KEY}_${userId}`;
      await AsyncStorage.removeItem(key);
      
      console.log('✅ All hidden posts cleared for user:', userId);
      return true;
    } catch (error) {
      console.error('Error clearing hidden posts:', error);
      return false;
    }
  }
}
