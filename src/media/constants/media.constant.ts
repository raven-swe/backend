export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const IMAGE_QUALITY = 85;
export const MAX_WIDTH = 2048;
export const MAX_HEIGHT = 2048;
export const MAX_VIDEO_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
export const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'mov'];
export const GIF_EXTENSIONS = ['gif'];
export const ALLOWED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...GIF_EXTENSIONS];
export const PENDING_MEDIA_CLEANUP_THRESHOLD_HOURS = 24; // 0 hours for testing purposes

export const MEDIA_CODES = {
  MEDIA_UPLOAD_SAVE_FAILED: 'MEDIA_UPLOAD_SAVE_FAILED',
  NO_FILES_PROVIDED: 'NO_FILES_PROVIDED',
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
  INVALID_URL: 'INVALID_URL',
  UNAUTHORIZED_DELETE: 'UNAUTHORIZED_DELETE',
  GIF_UPLOAD_FAILED: 'GIF_UPLOAD_FAILED',
  GIF_NOT_FOUND: 'GIF_NOT_FOUND',
} as const;

export const MEDIA_MESSAGES = {
  MEDIA_UPLOAD_SAVE_FAILED: 'Failed to upload and save media.',
  NO_FILES_PROVIDED: 'No files were provided for upload.',
  MEDIA_NOT_FOUND: 'Media not found.',
  INVALID_URL: 'The provided URL is invalid.',
  UNAUTHORIZED_DELETE: 'Unauthorized attempt to delete media.',
  ALLOWED_IMAGE_TYPES: 'Only image files are allowed (jpg, jpeg, png, webp).',
  ALLOWED_VIDEO_TYPES: 'Only video files are allowed (mp4, mkv, webm, mov).',
  GIF_UPLOAD_FAILED: 'Failed to upload GIF from Tenor.',
  GIF_NOT_FOUND: 'GIF not found on Tenor with the provided ID.',
} as const;
