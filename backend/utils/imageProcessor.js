import sharp from 'sharp';

/**
 * Compress and resize a base64-encoded image
 * - Max width: 1024px (preserves aspect ratio)
 * - JPEG quality: 80
 * - Strips metadata
 * 
 * @param {string} base64String - Base64 image data (with or without data URI prefix)
 * @returns {Promise<string>} Compressed base64 string with data URI prefix
 */
export async function compressImage(base64String) {
  try {
    // Strip data URI prefix if present
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const inputBuffer = Buffer.from(base64Data, 'base64');

    const originalSize = inputBuffer.length;
    console.log(`📦 Original image size: ${(originalSize / 1024).toFixed(1)} KB`);

    const compressedBuffer = await sharp(inputBuffer)
      .resize(768, 768, {   // 768px instead of 1024px — smaller = faster
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 50 })  // Compressed harder: 75 -> 50
      .toBuffer();

    const compressedSize = compressedBuffer.length;
    const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    console.log(`📦 Compressed size: ${(compressedSize / 1024).toFixed(1)} KB (${savings}% savings)`);

    return `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('❌ Image compression failed:', error.message);
    // Return original if compression fails
    if (!base64String.startsWith('data:')) {
      return `data:image/jpeg;base64,${base64String}`;
    }
    return base64String;
  }
}

/**
 * Convert base64 image to a temporary file URL or buffer for API consumption
 * @param {string} base64String - Base64 image data
 * @returns {Buffer} Image buffer
 */
export function base64ToBuffer(base64String) {
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}
