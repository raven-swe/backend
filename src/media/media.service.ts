import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { S3Service } from './s3/s3.service';
import { MediaRepository } from './media.repository';
import { MediaFolder } from './enums';
import sharp from 'sharp';
import { MediaDto } from './dtos';
import { detectMediaType } from './utils';
import { MediaType } from '@prisma/client';
import { MEDIA_CODES, MEDIA_MESSAGES } from './constants';
import { processImage } from './utils/process-image.util';

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

      let processedBuffer = file.buffer;
      let width = 0;
      let height = 0;

      if (mediaType === MediaType.IMAGE) {
        const processedImage = await processImage(file);
        processedBuffer = processedImage.buffer;
        width = processedImage.width;
        height = processedImage.height;
        file.buffer = processedBuffer;
      }

      // Upload to S3
      const { key, url } = await this.s3Service.uploadFile({ file, folder });
      uploadedKey = key;

      this.logger.log(`File uploaded to S3 with URL: ${url}`);

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
          message: MEDIA_MESSAGES.MEDIA_UPLOAD_SAVE_FAILED,
          code: MEDIA_CODES.MEDIA_UPLOAD_SAVE_FAILED,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteMedia(url: string, userId: bigint): Promise<void> {
    let mediaRecord = null;

    try {
      mediaRecord = await this.mediaRepository.findByUrl(url);

      if (!mediaRecord) {
        this.logger.error(`Media record not found for URL: ${url}`);
        throw new HttpException(
          {
            message: MEDIA_MESSAGES.MEDIA_NOT_FOUND,
            code: MEDIA_CODES.MEDIA_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Verify ownership
      if (mediaRecord.userId !== userId) {
        throw new HttpException(
          {
            message: MEDIA_MESSAGES.UNAUTHORIZED_DELETE,
            code: MEDIA_CODES.UNAUTHORIZED_DELETE,
          },
          HttpStatus.FORBIDDEN,
        );
      }

      // Delete from database first
      await this.mediaRepository.deleteMedia(mediaRecord.id);
      this.logger.log(`Media metadata deleted from database: ${mediaRecord.id}`);

      // Delete from S3
      const key = this.s3Service.extractKeyFromUrl(url);
      await this.s3Service.deleteFile(key);
      this.logger.log(`Successfully deleted media from S3: ${url}`);
    } catch (error) {
      this.logger.error(`Failed to delete media metadata: ${error}`);

      // Rollback if S3 deletion failed to restore DB record
      if (mediaRecord && error instanceof Error && error.message?.includes('S3')) {
        try {
          await this.mediaRepository.saveMedia({
            userId: mediaRecord.userId,
            url: mediaRecord.url,
            type: mediaRecord.type,
            width: mediaRecord.width!,
            height: mediaRecord.height!,
            altText: mediaRecord.altText ?? undefined,
          });
          this.logger.log(`Successfully restored media metadata: ${mediaRecord.id}`);
        } catch (rollbackError) {
          this.logger.error(`Failed to restore media metadata: ${rollbackError}`);
        }
      }

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
    altText?: string,
  ) {
    const { avatar, banner } = files;
    let avatarUrl: string | null = null;
    let bannerUrl: string | null = null;

    if (avatar == null && banner == null) {
      throw new HttpException(
        {
          message: MEDIA_MESSAGES.NO_FILES_PROVIDED,
          code: MEDIA_CODES.NO_FILES_PROVIDED,
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
