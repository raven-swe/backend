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
import { MediaService } from './media.service';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from './constants/media.constant';
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
          if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
            return callback(
              new BadRequestException(
                createValidationError(file.fieldname, {
                  invalidFileType:
                    'Only image and video files are allowed (jpg,.',
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
    @UploadedFiles() file: Express.Multer.File,
    @Body('altText') altText?: string,
    @Body('folder') folder: MediaFolder = MediaFolder.TWEETS,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided for upload');
    });

    return this.mediaService.uploadAndSaveMedia(file, BigInt(user.id), altText);
  }
}
