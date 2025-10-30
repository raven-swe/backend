import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { S3Service } from './s3/s3.service';
import { MediaRepository } from './media.repository';
import { MediaFolder } from './enums/media-folder.enum';
import sharp from 'sharp';
import { MediaDto } from './dtos/media.dto';
import { detectMediaType } from './utils/detect-media-type.util';
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
   * @returns The URL of the uploaded media
   *
   * @throws HttpException if upload or save fails
   */
  async uploadAndSaveMedia(
    file: Express.Multer.File,
    userId: bigint,
    folder: MediaFolder,
    altText?: string,
  ): Promise<string> {
    let uploadedKey: string | null = null;

    try {
      const mediaType = detectMediaType(file);

      // Upload to S3
      const { key, url } = await this.s3Service.uploadFile({ file, folder });
      uploadedKey = key;

      this.logger.log(`File uploaded to S3 with URL: ${url}`);

      const { width, height } =
        mediaType == MediaType.IMAGE
          ? await this.getImageDimensions(file)
          : { width: 0, height: 0 };

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

      return url;
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

      throw new HttpException(
        {
          message: 'Failed to upload and save media',
          code: 'MEDIA_UPLOAD_SAVE_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
    altText?: string,
  ) {
    const { avatar, banner } = files;
    let avatarUrl: string | null = null;
    let bannerUrl: string | null = null;

    if (avatar == null && banner == null) {
      throw new HttpException(
        {
          message: 'No files provided for upload',
          code: 'NO_FILES_PROVIDED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (avatar && avatar.length > 0) {
      avatarUrl = await this.uploadAndSaveMedia(avatar[0], userId, MediaFolder.AVATARS, altText);
    }

    if (banner && banner.length > 0) {
      bannerUrl = await this.uploadAndSaveMedia(banner[0], userId, MediaFolder.BANNERS, altText);
    }

    return { message: 'Avatar and/or banner uploaded successfully', avatarUrl, bannerUrl };
  }
}
