import * as FileSystem from 'expo-file-system';

/**
 * Convert an image URI to base64 string
 * @param uri - The image URI to convert
 * @returns Promise<string> - Base64 encoded string
 */
export const convertImageToBase64 = async (uri: string): Promise<string> => {
  try {
    // Use Expo FileSystem to read the file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    console.log('✅ [ImageUtils] Successfully converted image to base64');
    return base64;
  } catch (error) {
    console.error('❌ [ImageUtils] Error converting image to base64:', error);
    throw new Error('Failed to convert image to base64');
  }
};

/**
 * Validate if a URI is an image
 * @param uri - The URI to validate
 * @returns boolean - True if it's an image
 */
export const isImageUri = (uri: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const lowerUri = uri.toLowerCase();
  return imageExtensions.some(ext => lowerUri.includes(ext));
};

/**
 * Get image data URL from base64
 * @param base64 - Base64 string
 * @param mimeType - MIME type (default: image/jpeg)
 * @returns string - Data URL
 */
export const getImageDataUrl = (base64: string, mimeType: string = 'image/jpeg'): string => {
  return `data:${mimeType};base64,${base64}`;
};
