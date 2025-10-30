export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
export const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'mov'];
export const ALLOWED_FILE_EXTENSIONS = [...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_VIDEO_EXTENSIONS];
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/x-matroska',
  'video/webm',
  'video/quicktime',
];
export const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES];
