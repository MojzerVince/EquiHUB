import * as FileSystem from 'expo-file-system';
import { Horse, supabase } from './supabase';

export class HorseAPI {
  // Get all horses for a user
  static async getHorses(userId: string): Promise<Horse[]> {
    try {
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
    weight?: number | null; // Allow null values for weight
    breed: string;
    image?: any;
  }): Promise<Horse | null> {
    try {
      let imageBase64 = null;

      // Convert image to base64 if provided
      if (horseData.image && horseData.image.uri) {
        imageBase64 = await FileSystem.readAsStringAsync(horseData.image.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      // Use direct REST API (Supabase client has compatibility issues)
      const supabaseUrl = 'https://grdsqxwghajehneksxik.supabase.co';
      const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms';
      
      const newHorse = {
        user_id: userId,
        name: horseData.name,
        gender: horseData.gender,
        birth_date: horseData.birth_date,
        height: horseData.height,
        weight: horseData.weight || null,
        breed: horseData.breed,
        image_url: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const response = await fetch(`${supabaseUrl}/rest/v1/horses`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(newHorse)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔥 HorseAPI: Error adding horse:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      const addedHorse = data && data.length > 0 ? data[0] : data;
      
      return addedHorse;
    } catch (error) {
      console.error('🔥 HorseAPI: Error in addHorse:', error);
      return null;
    }
  }

  // Update a horse
  static async updateHorse(horseId: string, userId: string, updates: {
    name?: string;
    gender?: string;
    birth_date?: string;
    height?: number;
    weight?: number | null; // Allow null to delete weight
    breed?: string;
    image?: any;
  }): Promise<Horse | null> {
    try {
      let imageBase64 = undefined;

      // Convert new image to base64 if provided
      if (updates.image && updates.image.uri) {
        imageBase64 = await FileSystem.readAsStringAsync(updates.image.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const updateData: any = { ...updates };
      delete updateData.image; // Remove image from updates
      if (imageBase64) {
        updateData.image_url = `data:image/jpeg;base64,${imageBase64}`;
      }
      updateData.updated_at = new Date().toISOString();

      // Use direct REST API (Supabase client has compatibility issues)
      const supabaseUrl = 'https://grdsqxwghajehneksxik.supabase.co';
      const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms';

      const response = await fetch(`${supabaseUrl}/rest/v1/horses?id=eq.${horseId}&user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔥 HorseAPI: Error updating horse:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      const updatedHorse = data && data.length > 0 ? data[0] : data;
      return updatedHorse;
    } catch (error) {
      console.error('🔥 HorseAPI: Error in updateHorse:', error);
      return null;
    }
  }

  // Delete a horse
  static async deleteHorse(horseId: string, userId: string): Promise<boolean> {
    try {
      // Use direct REST API to get horse data first
      const supabaseUrl = 'https://grdsqxwghajehneksxik.supabase.co';
      const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms';

      // Get horse data to delete image
      const getResponse = await fetch(`${supabaseUrl}/rest/v1/horses?id=eq.${horseId}&user_id=eq.${userId}&select=image_url`, {
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (getResponse.ok) {
        const horses = await getResponse.json();
        const horse = horses && horses.length > 0 ? horses[0] : null;
        
        // Delete image if exists
        if (horse?.image_url) {
          await this.deleteImage(horse.image_url);
        }
      }

      // Delete the horse using direct API
      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/horses?id=eq.${horseId}&user_id=eq.${userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.error('🔥 HorseAPI: Error deleting horse:', deleteResponse.status, errorText);
        return false;
      }

      console.log('🔥 HorseAPI: ✅ Horse deleted successfully');
      return true;
    } catch (error) {
      console.error('🔥 HorseAPI: Error in deleteHorse:', error);
      return false;
    }
  }

  // Upload image to Supabase Storage
  static async uploadImage(imageUri: string, userId: string): Promise<string | null> {
    try {
      console.log('🔥 HorseAPI: Starting image upload for user:', userId);
      console.log('🔥 HorseAPI: Image URI:', imageUri);
      
      const timestamp = Date.now();
      const fileName = `${userId}/horses/${timestamp}.jpg`;
      console.log('🔥 HorseAPI: Generated filename:', fileName);

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('🔥 HorseAPI: File read as base64, length:', base64.length);

      // Convert base64 to blob using the standard approach
      const response = await fetch(`data:image/jpeg;base64,${base64}`);
      const blob = await response.blob();
      console.log('🔥 HorseAPI: Blob created, size:', blob.size);

      // Try to upload using Supabase client
      const { data, error } = await supabase.storage
        .from('horse-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) {
        console.error('🔥 HorseAPI: Supabase upload error:', error);
        
        // For now, if storage fails, we'll save without image
        // This prevents the entire horse creation from failing
        console.log('🔥 HorseAPI: Storage upload failed, saving horse without image');
        return null;
      }

      console.log('🔥 HorseAPI: Upload successful:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('horse-images')
        .getPublicUrl(fileName);

      console.log('🔥 HorseAPI: ✅ Image uploaded successfully, public URL:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('🔥 HorseAPI: Error in uploadImage:', error);
      // Return null instead of throwing error to allow horse creation without image
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