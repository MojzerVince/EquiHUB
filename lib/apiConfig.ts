/**
 * Centralized API configuration
 * This file contains all API endpoints and URLs to avoid duplication
 */

export const API_CONFIG = {
  // Supabase Configuration
  SUPABASE_URL: 'https://grdsqxwghajehneksxik.supabase.co',
  SUPABASE_REST_URL: 'https://grdsqxwghajehneksxik.supabase.co/rest/v1',
  
  // API Endpoints
  ENDPOINTS: {
    PROFILES: '/profiles',
    HORSES: '/horses',
    FRIENDSHIPS: '/friendships',
    COMMUNITY_POSTS: '/community_posts',
    STABLE_MEMBERS: '/stable_members',
    STABLES: '/stables',
    USER_BADGES: '/user_badges',
    BADGES: '/badges',
    USER_PUSH_TOKENS: '/user_push_tokens',
    POST_LIKES: '/post_likes'
  },
  
  // Default Headers for API calls
  getHeaders: (authToken?: string) => ({
    'Content-Type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` })
  }),
  
  // Full URL builders
  getRestUrl: (endpoint: string) => `${API_CONFIG.SUPABASE_REST_URL}${endpoint}`,
  getProfileUrl: (userId?: string) => userId 
    ? `${API_CONFIG.SUPABASE_REST_URL}/profiles?id=eq.${userId}`
    : `${API_CONFIG.SUPABASE_REST_URL}/profiles`,
  getUserBadgesUrl: (userId: string) => 
    `${API_CONFIG.SUPABASE_REST_URL}/user_badges?user_id=eq.${userId}&select=*,badge:badges!user_badges_badge_id_fkey(*)`
};

export default API_CONFIG;
