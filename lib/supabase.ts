import { createClient } from '@supabase/supabase-js'

// Replace with your Supabase project URL and anon key
const supabaseUrl = 'https://grdsqxwghajehneksxik.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Export URL and key for direct API calls
export { supabaseAnonKey, supabaseUrl }

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
