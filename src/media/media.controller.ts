import { Body, Controller, Post, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { User } from 'src/auth/decorators';
import { MediaService } from './media.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_FILE_SIZE_BYTES, MAX_VIDEO_FILE_SIZE_BYTES } from './constants/media.constant';
import { JwtAuthGuard } from 'src/auth/guards';
import type { RequestUser } from 'src/common/interfaces';
import { imageFileFilter, videoFileFilter } from './validators/media-file.validator';
import { UploadMedia } from './dtos/upload-media.dto';
import { UploadGif } from './dtos/upload-gif.dto';

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
    @Body() body: UploadMedia,
  ) {
    return this.mediaService.uploadMedia(BigInt(user.id), file, body.folder, body.altText);
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
    @Body() body: UploadMedia,
  ) {
    return this.mediaService.uploadMedia(BigInt(user.id), file, body.folder, body.altText);
  }

  @Post('upload/gif')
  @UseGuards(JwtAuthGuard)
  async uploadGif(@User() user: RequestUser, @Body() body: UploadGif) {
    return this.mediaService.uploadGif(BigInt(user.id), body.tenorId);
  }
}
