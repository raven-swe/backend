import { MediaType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '../constants/media.constant';

/**
 * Detects media type from file extension and magic bytes
 *
 * @param file - The uploaded file
 * @returns The detected MediaType
 * @throws BadRequestException if media type cannot be determined
 */
export function detectMediaType(file: Express.Multer.File): MediaType {
  const filename = file.originalname?.toLowerCase();
  const ext = filename.split('.').pop() || '';

  if (IMAGE_EXTENSIONS.includes(ext)) {
    if (ext === 'gif') {
      return MediaType.GIF;
    }
    return MediaType.IMAGE;
  }

  if (VIDEO_EXTENSIONS.includes(ext)) {
    return MediaType.VIDEO;
  }

  // Fallback to MIME type detection if extension doesn't match
  const mimeType = file.mimetype.toLowerCase();

  // Image MIME types
  if (mimeType.startsWith('image/')) {
    if (mimeType === 'image/gif') {
      return MediaType.GIF;
    }
    return MediaType.IMAGE;
  }

  // Video MIME types
  if (mimeType.startsWith('video/')) {
    return MediaType.VIDEO;
  }

  throw new BadRequestException(
    createValidationError('file', {
      unsupportedMediaType: `Unsupported file type: ${ext || mimeType}. Only image (jpg, jpeg, png, gif) and video (mp4, mkv, webm) files are allowed.`,
    }),
  );
}
