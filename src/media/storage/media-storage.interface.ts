export const MEDIA_STORAGE = 'MEDIA_STORAGE';

export interface UploadFileParams {
  file: Express.Multer.File;
  folder: string;
  fileName?: string;
}

export interface MediaStorage {
  uploadFile(params: UploadFileParams): Promise<{ key: string }>;

  deleteFile(key: string): Promise<void>;

  fileExists(key: string): Promise<boolean>;
}
