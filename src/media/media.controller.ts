import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';
import { MediaService } from './media.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from './constants/media.constant';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('/upload')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
      ],
      {
        fileFilter: (req, file, callback) => {
          const ext = file.originalname.split('.').pop()?.toLowerCase();
          if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
            return callback(
              new BadRequestException(
                createValidationError(file.fieldname, {
                  invalidFileType:
                    'Only image and video files are allowed (jpg, jpeg, png, gif, mp4, mkv, webm, mov).',
                }),
              ),
              false,
            );
          }

          callback(null, true);
        },
        limits: { fileSize: MAX_FILE_SIZE_BYTES },
      },
    ),
  )
  @UseGuards(JwtAuthGuard)
  async uploadMedia(
    @User() user: RequestUser,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File;
      banner?: Express.Multer.File;
    },
  ) {
    // Validate that at least one file is uploaded
    if (!files || (!files.avatar && !files.banner)) {
      throw new BadRequestException('At least one file (avatar or banner) must be uploaded');
    }

    const userIdBigInt = BigInt(user.id);

    return await this.mediaService.uploadAvatarAndBanner(userIdBigInt, files);
  }
}
