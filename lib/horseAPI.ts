import * as FileSystem from 'expo-file-system';
import { Horse, supabase } from './supabase';

export class HorseAPI {
  // Get all horses for a user
  static async getHorses(userId: string): Promise<Horse[]> {
    try {
      console.log('🔥 HorseAPI: Fetching horses for user:', userId);
      
      // Use direct REST API (Supabase client has compatibility issues)
      const supabaseUrl = 'https://grdsqxwghajehneksxik.supabase.co';
      const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms';
      
      const apiUrl = `${supabaseUrl}/rest/v1/horses?user_id=eq.${userId}&order=created_at.desc`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔥 HorseAPI: API error:', response.status, errorText);
        return [];
      }

      const data = await response.json();
      console.log('🔥 HorseAPI: ✅ Successfully retrieved', data.length, 'horses');
      
      return data || [];
      
    } catch (error) {
      console.error('🔥 HorseAPI: Error fetching horses:', error);
      return [];
    }
  }

  // Add a new horse
  static async addHorse(userId: string, horseData: {
    name: string;
    gender: string;
    birth_date: string;
    height: number;
    weight?: number;
    breed: string;
    image?: any;
  }): Promise<Horse | null> {
    try {
      console.log('Adding horse for user:', userId, horseData);

      let imageUrl = null;

      // Upload image if provided
      if (horseData.image && horseData.image.uri) {
        imageUrl = await this.uploadImage(horseData.image.uri, userId);
      }

      const { data, error } = await supabase
        .from('horses')
        .insert([
          {
            user_id: userId,
            name: horseData.name,
            gender: horseData.gender,
            birth_date: horseData.birth_date,
            height: horseData.height,
            weight: horseData.weight || null,
            breed: horseData.breed,
            image_url: imageUrl,
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error adding horse:', error);
        return null;
      }

      console.log('Added horse:', data);
      return data;
    } catch (error) {
      console.error('Error in addHorse:', error);
      return null;
    }
  }

  // Update a horse
  static async updateHorse(horseId: string, userId: string, updates: {
    name?: string;
    gender?: string;
    birth_date?: string;
    height?: number;
    weight?: number;
    breed?: string;
    image?: any;
  }): Promise<Horse | null> {
    try {
      console.log('Updating horse:', horseId, updates);

      let imageUrl = undefined;

      // Upload new image if provided
      if (updates.image && updates.image.uri) {
        imageUrl = await this.uploadImage(updates.image.uri, userId);
      }

      const updateData: any = { ...updates };
      delete updateData.image; // Remove image from updates
      if (imageUrl) {
        updateData.image_url = imageUrl;
      }

      const { data, error } = await supabase
        .from('horses')
        .update(updateData)
        .eq('id', horseId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating horse:', error);
        return null;
      }

      console.log('Updated horse:', data);
      return data;
    } catch (error) {
      console.error('Error in updateHorse:', error);
      return null;
    }
  }

  // Delete a horse
  static async deleteHorse(horseId: string, userId: string): Promise<boolean> {
    try {
      console.log('Deleting horse:', horseId);

      // Get horse data to delete image
      const { data: horse } = await supabase
        .from('horses')
        .select('image_url')
        .eq('id', horseId)
        .eq('user_id', userId)
        .single();

      // Delete image if exists
      if (horse?.image_url) {
        await this.deleteImage(horse.image_url);
      }

      const { error } = await supabase
        .from('horses')
        .delete()
        .eq('id', horseId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting horse:', error);
        return false;
      }

      console.log('Horse deleted successfully');
      return true;
    } catch (error) {
      console.error('Error in deleteHorse:', error);
      return false;
    }
  }

  // Upload image to Supabase Storage
  static async uploadImage(imageUri: string, userId: string): Promise<string | null> {
    try {
      const timestamp = Date.now();
      const fileName = `${userId}/horses/${timestamp}.jpg`;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to blob
      const response = await fetch(`data:image/jpeg;base64,${base64}`);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('horse-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) {
        console.error('Error uploading image:', error);
        return null;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('horse-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      return null;
    }
  }

  // Delete image from Supabase Storage
  static async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts.slice(-3).join('/'); // userId/horses/filename.jpg

      await supabase.storage
        .from('horse-images')
        .remove([fileName]);
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }
}