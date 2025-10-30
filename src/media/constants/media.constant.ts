export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];
export const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'mov'];
export const ALLOWED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

export const MEDIA_CODES = {
  MEDIA_UPLOAD_SAVE_FAILED: 'MEDIA_UPLOAD_SAVE_FAILED',
  NO_FILES_PROVIDED: 'NO_FILES_PROVIDED',
};

export const MEDIA_MESSAGES = {
  MEDIA_UPLOAD_SAVE_FAILED: 'Failed to upload and save media',
  NO_FILES_PROVIDED: 'No files provided for upload',
};
