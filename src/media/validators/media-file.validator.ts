import { BadRequestException } from '@nestjs/common';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import {
  MEDIA_MESSAGES,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  GIF_EXTENSIONS,
} from '../constants/media.constant';

export const imageFileFilter = (
  req: never,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const ext = file.originalname.split('.').pop()?.toLowerCase();

  if (!ext || ![...IMAGE_EXTENSIONS, ...GIF_EXTENSIONS].includes(ext)) {
    return callback(
      new BadRequestException(
        createValidationError(file.fieldname, {
          invalidFileType: MEDIA_MESSAGES.ALLOWED_IMAGE_TYPES,
        }),
      ),
      false,
    );
  }

  callback(null, true);
};

export const videoFileFilter = (
  req: never,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const ext = file.originalname.split('.').pop()?.toLowerCase();

  if (!ext || !VIDEO_EXTENSIONS.includes(ext)) {
    return callback(
      new BadRequestException(
        createValidationError(file.fieldname, {
          invalidFileType: MEDIA_MESSAGES.ALLOWED_VIDEO_TYPES,
        }),
      ),
      false,
    );
  }

  callback(null, true);
};

export const profileImageFileFilter = (
  req: never,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const ext = file.originalname.split('.').pop()?.toLowerCase();

  if (!ext || !IMAGE_EXTENSIONS.includes(ext)) {
    return callback(
      new BadRequestException(
        createValidationError(file.fieldname, {
          invalidFileType: MEDIA_MESSAGES.ALLOWED_IMAGE_TYPES,
        }),
      ),
      false,
    );
  }

  callback(null, true);
};
