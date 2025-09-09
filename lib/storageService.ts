import { getSupabase } from './supabase';

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export class StorageService {
  
  /**
   * Upload a badge icon to Supabase Storage
   */
  static async uploadBadgeIcon(file: File, fileName?: string): Promise<UploadResult> {
    try {
      const supabase = getSupabase();
      
      // Generate unique filename if not provided
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const finalFileName = fileName || `badge_${timestamp}.${fileExtension}`;
      const filePath = `badges/${finalFileName}`;

      // Upload file to badges bucket
      const { data, error } = await supabase.storage
        .from('badges')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false // Don't overwrite existing files
        });

      if (error) {
        console.error('Upload error:', error);
        return { success: false, error: error.message };
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('badges')
        .getPublicUrl(data.path);

      return {
        success: true,
        url: publicUrlData.publicUrl,
        path: data.path
      };
    } catch (error) {
      console.error('Upload exception:', error);
      return { success: false, error: 'Upload failed' };
    }
  }

  /**
   * Upload a challenge icon to Supabase Storage
   */
  static async uploadChallengeIcon(file: File, fileName?: string): Promise<UploadResult> {
    try {
      const supabase = getSupabase();
      
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const finalFileName = fileName || `challenge_${timestamp}.${fileExtension}`;
      const filePath = `challenges/${finalFileName}`;

      const { data, error } = await supabase.storage
        .from('challenges')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: publicUrlData } = supabase.storage
        .from('challenges')
        .getPublicUrl(data.path);

      return {
        success: true,
        url: publicUrlData.publicUrl,
        path: data.path
      };
    } catch (error) {
      return { success: false, error: 'Upload failed' };
    }
  }

  /**
   * Upload a global challenge icon to Supabase Storage
   */
  static async uploadGlobalChallengeIcon(file: File, challengeId: string, fileName?: string): Promise<UploadResult> {
    try {
      const supabase = getSupabase();
      
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const finalFileName = fileName || `global_challenge_${challengeId}_${timestamp}.${fileExtension}`;
      const filePath = `global-challenges/${finalFileName}`;

      const { data, error } = await supabase.storage
        .from('global-challenges')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: publicUrlData } = supabase.storage
        .from('global-challenges')
        .getPublicUrl(data.path);

      return {
        success: true,
        url: publicUrlData.publicUrl,
        path: data.path
      };
    } catch (error) {
      return { success: false, error: 'Upload failed' };
    }
  }

  /**
   * Upload a stable icon/logo to Supabase Storage
   */
  static async uploadStableIcon(file: File, stableId: string, fileName?: string): Promise<UploadResult> {
    try {
      const supabase = getSupabase();
      
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const finalFileName = fileName || `stable_${stableId}_${timestamp}.${fileExtension}`;
      const filePath = `stables/${finalFileName}`;

      const { data, error } = await supabase.storage
        .from('stables')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true // Allow overwriting stable logos
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: publicUrlData } = supabase.storage
        .from('stables')
        .getPublicUrl(data.path);

      return {
        success: true,
        url: publicUrlData.publicUrl,
        path: data.path
      };
    } catch (error) {
      return { success: false, error: 'Upload failed' };
    }
  }

  /**
   * Upload a profile image to Supabase Storage
   */
  static async uploadProfileImage(file: File, userId: string): Promise<UploadResult> {
    try {
      const supabase = getSupabase();
      
      const fileExtension = file.name.split('.').pop();
      const finalFileName = `profile_${userId}.${fileExtension}`;
      const filePath = `profiles/${finalFileName}`;

      const { data, error } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true // Allow overwriting profile images
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: publicUrlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(data.path);

      return {
        success: true,
        url: publicUrlData.publicUrl,
        path: data.path
      };
    } catch (error) {
      return { success: false, error: 'Upload failed' };
    }
  }

  /**
   * Upload general images to Supabase Storage
   */
  static async uploadImage(file: File, bucket: string, folder: string, fileName?: string): Promise<UploadResult> {
    try {
      const supabase = getSupabase();
      
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const finalFileName = fileName || `image_${timestamp}.${fileExtension}`;
      const filePath = `${folder}/${finalFileName}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return {
        success: true,
        url: publicUrlData.publicUrl,
        path: data.path
      };
    } catch (error) {
      return { success: false, error: 'Upload failed' };
    }
  }

  /**
   * Delete a file from Supabase Storage
   */
  static async deleteFile(bucket: string, filePath: string): Promise<boolean> {
    try {
      const supabase = getSupabase();
      
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        console.error('Delete error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Delete exception:', error);
      return false;
    }
  }

  /**
   * Get public URL for an existing file
   */
  static getPublicUrl(bucket: string, filePath: string): string {
    const supabase = getSupabase();
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  }

  /**
   * List files in a bucket folder
   */
  static async listFiles(bucket: string, folder?: string): Promise<any[]> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder, {
          limit: 100,
          offset: 0
        });

      if (error) {
        console.error('List files error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('List files exception:', error);
      return [];
    }
  }

  /**
   * Create a storage bucket (admin function)
   */
  static async createBucket(bucketId: string, isPublic: boolean = true): Promise<boolean> {
    try {
      const supabase = getSupabase();
      
      const { error } = await supabase.storage
        .createBucket(bucketId, {
          public: isPublic,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          fileSizeLimit: 5242880 // 5MB limit
        });

      if (error) {
        console.error('Create bucket error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Create bucket exception:', error);
      return false;
    }
  }

  /**
   * Helper function to validate image file
   */
  static validateImageFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Please upload JPEG, PNG, WebP, or GIF images.' };
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { valid: false, error: 'File size too large. Please upload images under 5MB.' };
    }

    return { valid: true };
  }

  /**
   * Helper function to resize image before upload (for web usage)
   */
  static async resizeImage(file: File, maxWidth: number = 800, maxHeight: number = 600, quality: number = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(resizedFile);
          } else {
            resolve(file); // Return original if resize fails
          }
        }, file.type, quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }
}
