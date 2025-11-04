import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { secureConfig } from './secureConfig';

// Initialize secure configuration
let supabaseClient: any = null;

export const initializeSupabase = async () => {
  try {
    let config;
    
    try {
      // Try to get config from secure config first
      await secureConfig.initialize();
      config = secureConfig.getSupabaseConfig();
      console.log('✅ Using secure config for Supabase');
    } catch (error) {
      console.log('⚠️ Secure config failed, using fallback configuration');
      // Fallback to hardcoded Supabase config for EquiHUB
      config = {
        url: 'https://grdsqxwghajehneksxik.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms'
      };
    }
    
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true, // Enable URL session detection for OAuth
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
  try {
    return secureConfig.getSupabaseConfig();
  } catch (error) {
    // Fallback to hardcoded config
    return {
      url: 'https://grdsqxwghajehneksxik.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms'
    };
  }
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
    path?: Array<{
      latitude: number
      longitude: number
      timestamp: number
      accuracy?: number
      speed?: number
    }>
    path_enabled?: boolean
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
