import { Body, Controller, Post, UploadedFiles, UseGuards } from '@nestjs/common';
import { User } from 'src/auth/decorators';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import type { RequestUser } from 'src/auth/types';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  async uploadMedia(
    @User() user: RequestUser,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File;
      banner?: Express.Multer.File;
    },
  ) {
    const userIdBigInt = BigInt(user.id);
    return await this.mediaService.uploadAvatarAndBanner(userIdBigInt, files);
  }
}
