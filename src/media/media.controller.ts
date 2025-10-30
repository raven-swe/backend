import {
  Body,
  Controller,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';
import { MediaService } from './media.service';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { MediaType } from '@prisma/client';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('/upload')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'avatar', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ]),
  )
  @UseGuards(JwtAuthGuard)
  async uploadMedia(
    @User() user: RequestUser,
    // @UploadedFiles(
    //   new ParseFilePipeBuilder()
    //     .addFileTypeValidator({
    //       fileType: /image\/.*/,
    //     })

    //     .addMaxSizeValidator({
    //       maxSize: 5 * 1024 * 1024, // 5 MB
    //     })
    //     .build({
    //       errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    //       fileIsRequired: false,
    //     }),
    // )

    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      banner?: Express.Multer.File[];
    },
    @Body('mediaType') mediaType: MediaType,
    @Body('altText') altText?: string,
  ) {
    console.log('FILES: ', files['avatar'], files['banner']);

    const userIdBigInt = BigInt(user.id);
    return await this.mediaService.uploadAvatarAndBanner(userIdBigInt, files, mediaType, altText);
  }
}
