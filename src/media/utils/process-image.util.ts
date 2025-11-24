import sharp from 'sharp';
import { IMAGE_QUALITY, MAX_HEIGHT, MAX_WIDTH } from '../constants';
import { Logger } from '@nestjs/common';

export async function processImage(
  file: Express.Multer.File,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const logger = new Logger('processImage');

  try {
    let image = sharp(file.buffer);
    const metadata = await image.metadata();

    if (
      (metadata.width && metadata.width > MAX_WIDTH) ||
      (metadata.height && metadata.height > MAX_HEIGHT)
    ) {
      image = image.resize(MAX_WIDTH, MAX_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to JPEG with specified quality for optimization
    if (metadata.format === 'png') {
      image = image.png({
        quality: IMAGE_QUALITY,
        compressionLevel: 9,
      });
    } else {
      image = image.jpeg({
        quality: IMAGE_QUALITY,
        progressive: true,
      });
    }

    const processedBuffer = await image.toBuffer();
    const processedMetadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      width: processedMetadata.width ?? 0,
      height: processedMetadata.height ?? 0,
    };
  } catch (error) {
    logger.error('Failed to process image', error);
    throw error;
  }
}
