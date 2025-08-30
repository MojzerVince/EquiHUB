import * as ImageManipulator from 'expo-image-manipulator';

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0
  format?: 'jpeg' | 'png';
}

export class ImageCompression {
  // Compress image to reduce file size and data usage
  static async compressImage(
    imageUri: string, 
    options: ImageCompressionOptions = {}
  ): Promise<{ uri: string; size?: number }> {
    try {
      const {
        maxWidth = 512,    // Reduced from typical 1024 to save more data
        maxHeight = 512,   // Square profile images
        quality = 0.6,     // Reduced from 0.8 to save more data
        format = 'jpeg'    // JPEG generally smaller than PNG
      } = options;

      console.log('🗜️ ImageCompression: Starting compression...');
      console.log('🗜️ ImageCompression: Original URI:', imageUri);

      // Manipulate the image to reduce size
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            resize: {
              width: maxWidth,
              height: maxHeight,
            },
          },
        ],
        {
          compress: quality,
          format: format === 'jpeg' ? ImageManipulator.SaveFormat.JPEG : ImageManipulator.SaveFormat.PNG,
          base64: false, // Don't include base64 in response to save memory
        }
      );

      console.log('🗜️ ImageCompression: Compressed URI:', manipulatedImage.uri);
      console.log('🗜️ ImageCompression: Compression completed successfully');

      return {
        uri: manipulatedImage.uri,
        size: manipulatedImage.width * manipulatedImage.height, // Approximate size metric
      };
    } catch (error) {
      console.error('🗜️ ImageCompression: Error compressing image:', error);
      // Return original image if compression fails
      return { uri: imageUri };
    }
  }

  // Get estimated file size reduction info
  static getCompressionInfo(originalWidth: number, originalHeight: number, options: ImageCompressionOptions = {}): {
    estimatedReduction: string;
    newDimensions: { width: number; height: number };
  } {
    const { maxWidth = 512, maxHeight = 512, quality = 0.6 } = options;
    
    // Calculate new dimensions (maintain aspect ratio)
    let newWidth = originalWidth;
    let newHeight = originalHeight;
    
    if (originalWidth > maxWidth || originalHeight > maxHeight) {
      const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
      newWidth = Math.round(originalWidth * ratio);
      newHeight = Math.round(originalHeight * ratio);
    }
    
    // Estimate size reduction
    const pixelReduction = (originalWidth * originalHeight) / (newWidth * newHeight);
    const qualityReduction = 1 / quality;
    const totalReduction = pixelReduction * qualityReduction;
    
    return {
      estimatedReduction: `~${Math.round((1 - 1/totalReduction) * 100)}%`,
      newDimensions: { width: newWidth, height: newHeight }
    };
  }
}
