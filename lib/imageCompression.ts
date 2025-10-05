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
        maxWidth = 400,    // Optimized for profile images (reduced from 512)
        maxHeight = 400,   // Square profile images
        quality = 0.5,     // Further reduced from 0.6 to save more data
        format = 'jpeg'    // JPEG generally smaller than PNG
      } = options;

      console.log('🗜️ ImageCompression: Starting compression...');
      console.log(`🗜️ ImageCompression: Target dimensions: ${maxWidth}x${maxHeight}, quality: ${quality}`);

      // Get original file info for comparison
      let originalSize: number | null = null;
      try {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        originalSize = blob.size;
        console.log(`🗜️ ImageCompression: Original file size: ${(originalSize / 1024).toFixed(2)} KB`);
      } catch (error) {
        console.log('🗜️ ImageCompression: Could not determine original file size');
      }

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

      // Get compressed file info for comparison
      if (originalSize) {
        try {
          const compressedResponse = await fetch(manipulatedImage.uri);
          const compressedBlob = await compressedResponse.blob();
          const compressedSize = compressedBlob.size;
          const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
          console.log(`🗜️ ImageCompression: Compressed file size: ${(compressedSize / 1024).toFixed(2)} KB`);
          console.log(`🗜️ ImageCompression: Data savings: ${savings}% (${((originalSize - compressedSize) / 1024).toFixed(2)} KB saved)`);
        } catch (error) {
          console.log('🗜️ ImageCompression: Could not determine compressed file size');
        }
      }

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
    const { maxWidth = 400, maxHeight = 400, quality = 0.5 } = options;
    
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
