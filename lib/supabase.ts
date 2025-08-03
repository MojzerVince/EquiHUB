import { createClient } from '@supabase/supabase-js'

// Replace with your Supabase project URL and anon key
const supabaseUrl = 'https://grdsqxwghajehneksxik.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Types
export interface Profile {
  id: string
  name: string
  age: number
  description: string
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
