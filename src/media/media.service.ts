import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { S3Service } from './s3.service';
import { MediaRepository } from './media.repository';
import { MediaFolder } from './enum/media-folder.enum';
import * as sharp from 'sharp';
import { MediaDto } from './dto/media.dto';
import { MediaType } from '@prisma/client';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly mediaRepository: MediaRepository,
  ) {}

  async uploadAndSaveMedia(
    file: Express.Multer.File,
    userId: bigint,
    folder: MediaFolder,
    mediaType: MediaType,
    altText?: string,
  ): Promise<MediaDto> {
    let uploadedKey: string;

    try {
      // Upload to S3
      const { key, url } = await this.s3Service.uploadFile({ file, folder });
      uploadedKey = key;

      this.logger.log(`File uploaded to S3 with URL: ${url}`);

      const { width, height } = await this.getImageDimensions(file);

      const mediaDto: MediaDto = {
        userId,
        url,
        type: mediaType,
        width,
        height,
        altText,
      };

      const saveMedia = await this.mediaRepository.saveMedia(mediaDto);

      this.logger.log(`Media metadata saved with ID: ${saveMedia.id}`);

      return saveMedia;
    } catch (error) {
      this.logger.error('Failed to upload media', error);

      // Media not uploaded 
    }
  }

  /**
   * Get image dimensions from buffer
   * You should install 'sharp' package for this: npm install sharp
   */
  private async getImageDimensions(
    file: Express.Multer.File,
  ): Promise<{ width: number; height: number }> {
    try {
      const metadata = await sharp(file.buffer).metadata();

      return { width: metadata.width || 0, height: metadata.height || 0 };
    } catch (error) {
      this.logger.error('Failed to get image dimensions', error);
      return { width: 0, height: 0 };
    }
  }

  async uploadAvatarAndBanner(
    userId: bigint,
    files: {
      avatar?: Express.Multer.File;
      banner?: Express.Multer.File;
    },
  ) {
    const { avatar, banner } = files;

    if (avatar) {
      await this.uploadAndSaveMedia(avatar, userId, MediaFolder.AVATARS);
    }

    if (banner) {
      await this.uploadAndSaveMedia(banner, userId, MediaFolder.BANNERS);
    }
  }
}
