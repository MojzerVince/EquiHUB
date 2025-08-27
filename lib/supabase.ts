import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { secureConfig } from './secureConfig';

// Initialize secure configuration
let supabaseClient: any = null;

export const initializeSupabase = async () => {
  try {
    await secureConfig.initialize();
    const config = secureConfig.getSupabaseConfig();
    
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    
    return supabaseClient;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    throw error;
  }
};

export const getSupabase = () => {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized. Call initializeSupabase() first.');
  }
  return supabaseClient;
};

// Get secure configuration for direct API calls
export const getSupabaseConfig = () => {
  return secureConfig.getSupabaseConfig();
};

// Legacy export for backward compatibility - will be removed in future versions
export const supabase = new Proxy({}, {
  get(target, prop) {
    console.warn('Direct supabase access is deprecated. Use getSupabase() instead.');
    return getSupabase()[prop];
  }
});

// Deprecated exports - use getSupabaseConfig() instead
export const supabaseAnonKey = '';
export const supabaseUrl = '';

// Database Types
export interface Profile {
  id: string
  name: string
  age: number
  description: string
  experience?: number
  is_pro_member?: boolean
  profile_image_url?: string
  created_at: string
  updated_at: string
}

export interface GalleryImage {
  id: string
  user_id: string
  image_url: string
  created_at: string
}

export interface Horse {
  id: string
  user_id: string
  name: string
  gender: string
  birth_date: string
  height: number
  weight?: number
  breed: string
  image_url?: string
  image_base64?: string
  created_at: string
  updated_at: string
}

export interface Badge {
  id: string
  name: string
  description: string
  icon_emoji: string
  icon_url?: string
  category: string
  rarity: string
  points_value: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
  progress: number
  metadata?: any
}

export interface UserBadgeWithDetails extends UserBadge {
  badge: Badge
}

// Community Posts Types
export interface CommunityPost {
  id: string
  user_id: string
  content: string
  image_url?: string
  image_base64?: string
  session_data?: {
    horse_name: string
    duration: string
    distance: string
    avg_speed: string
    session_id?: string
    horse_image_url?: string
  }
  likes_count: number
  created_at: string
  updated_at: string
}

export interface PostLike {
  id: string
  post_id: string
  user_id: string
  created_at: string
}
