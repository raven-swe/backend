import {
  Body,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  UploadedFile,
} from '@nestjs/common';
import { User } from 'src/auth/decorators';
import { MediaService } from './media.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_VIDEO_FILE_SIZE_BYTES,
  MEDIA_MESSAGES,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  GIF_EXTENSIONS,
} from './constants/media.constant';
import { JwtAuthGuard } from 'src/auth/guards';
import type { RequestUser } from 'src/common/interfaces';
import { MediaFolder } from './enums';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('/upload/image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (req, file, callback) => {
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
      },
    }),
  )
  @UseGuards(JwtAuthGuard)
  async uploadImage(
    @User() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('altText') altText?: string,
    @Body('folder') folder: MediaFolder = MediaFolder.TWEETS,
  ) {
    return this.mediaService.uploadMedia(BigInt(user.id), file, folder, altText);
  }

  @Post('/upload/video')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_VIDEO_FILE_SIZE_BYTES },
      fileFilter: (req, file, callback) => {
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
      },
    }),
  )
  @UseGuards(JwtAuthGuard)
  async uploadVideo(
    @User() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('altText') altText?: string,
    @Body('folder') folder: MediaFolder = MediaFolder.TWEETS,
  ) {
    return this.mediaService.uploadMedia(BigInt(user.id), file, folder, altText);
  }
}
