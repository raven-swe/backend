import { Body, Controller, Post, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { User } from 'src/auth/decorators';
import { MediaService } from './media.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_FILE_SIZE_BYTES, MAX_VIDEO_FILE_SIZE_BYTES } from './constants/media.constant';
import { JwtAuthGuard } from 'src/auth/guards';
import type { RequestUser } from 'src/common/interfaces';
import { MediaFolder } from './enums';
import { imageFileFilter, videoFileFilter } from './validators/media-file.validator';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('/upload/image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: imageFileFilter,
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
      fileFilter: videoFileFilter,
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
