import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { S3Service } from './s3.service';
import { MediaRepository } from './media.repository';
import { MediaFolder } from './enums/media-folder.enum';
import sharp from 'sharp';
import { MediaDto } from './dtos/media.dto';
import { MediaType } from '@prisma/client';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly mediaRepository: MediaRepository,
  ) {}

  /**
   * Upload file to S3 and save media metadata to database.
   * Handles rollback in case of failure.
   *
   * @param file - The file to upload
   * @param userId - The ID of the user uploading the media
   * @param folder - The folder to upload the media to
   * @param mediaType - The type of media being uploaded
   * @param altText - Optional alt text for the media
   *
   * @returns The saved MediaDto object andor throws an error if operation fails
   */
  async uploadAndSaveMedia(
    file: Express.Multer.File,
    userId: bigint,
    folder: MediaFolder,
    mediaType: MediaType,
    altText?: string,
  ): Promise<MediaDto> {
    let uploadedKey: string | null = null;

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

      const savedMedia = await this.mediaRepository.saveMedia(mediaDto);

      this.logger.log(`Media metadata saved with ID: ${savedMedia.id}`);

      return savedMedia as MediaDto;
    } catch (error) {
      this.logger.error('Failed to upload media', error);

      // Rollback: If database save failed, delete the uploaded file from S3
      if (uploadedKey) {
        this.logger.error(`Database save failed, rolling back S3 upload for key: ${uploadedKey}`);
        try {
          await this.s3Service.deleteFile(uploadedKey);
          this.logger.log(`Successfully rolled back S3 upload: ${uploadedKey}`);
        } catch (rollbackError) {
          this.logger.error(`Failed to rollback S3 upload for key: ${uploadedKey}`, rollbackError);
        }
      }

      this.logger.error('Upload and save media operation failed', error);
      throw error;
    }
  }

  /**
   * Get image dimensions from buffer
   */
  private async getImageDimensions(
    file: Express.Multer.File,
  ): Promise<{ width: number; height: number }> {
    try {
      const image = sharp(file.buffer);

      const { width, height } = await image.metadata();

      return { width: width ?? 0, height: height ?? 0 };
    } catch (error) {
      this.logger.error('Failed to get image dimensions', error);
      return { width: 0, height: 0 };
    }
  }

  async uploadAvatarAndBanner(
    userId: bigint,
    files: {
      avatar?: Express.Multer.File[];
      banner?: Express.Multer.File[];
    },
    mediaType: MediaType,
    altText?: string,
  ) {
    const { avatar, banner } = files;

    if (avatar) {
      await this.uploadAndSaveMedia(avatar[0], userId, MediaFolder.AVATARS, mediaType, altText);
    }

    if (banner) {
      await this.uploadAndSaveMedia(banner[0], userId, MediaFolder.BANNERS, mediaType, altText);
    }
  }
}
