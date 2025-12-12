import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { S3Service } from './s3/s3.service';
import { MediaRepository } from './media.repository';
import { MediaFolder } from './enums';
import sharp from 'sharp';
import { MediaDto } from './dtos';
import { detectMediaType } from './utils';
import { MediaType } from '@prisma/client';
import { processImage } from './utils/process-image.util';
import { MEDIA_CODES, MEDIA_MESSAGES, PENDING_MEDIA_CLEANUP_THRESHOLD_HOURS } from './constants';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenorResponse } from './interfaces';
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
    pending: boolean = false,
  ): Promise<{ url: string; id: string }> {
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
        pending,
      };

      const savedMedia = await this.mediaRepository.saveMedia(mediaDto);

      this.logger.log(`Media metadata saved with ID: ${savedMedia.id}`);

      return { url, id: savedMedia.id.toString() };
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
        HttpStatus.SERVICE_UNAVAILABLE,
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
            pending: mediaRecord.pending,
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

  async uploadAvatarOrBanner(
    userId: bigint,
    files: {
      avatar?: Express.Multer.File;
      banner?: Express.Multer.File;
    },
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

    if (avatar) {
      ({ url: avatarUrl } = await this.uploadAndSaveMedia(avatar, userId, MediaFolder.AVATARS));
    }

    if (banner) {
      ({ url: bannerUrl } = await this.uploadAndSaveMedia(banner, userId, MediaFolder.BANNERS));
    }

    return { avatarUrl, bannerUrl };
  }

  async uploadMedia(
    userId: bigint,
    file: Express.Multer.File,
    folder: MediaFolder,
    altText?: string,
  ) {
    if (!file) {
      throw new HttpException(
        {
          message: MEDIA_MESSAGES.NO_FILES_PROVIDED,
          code: MEDIA_CODES.NO_FILES_PROVIDED,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const items = await this.uploadAndSaveMedia(file, userId, folder, altText, true);
    return { ...items, message: 'Media uploaded successfully.' };
  }

  async uploadGif(currentUserId: bigint, tenorId: string): Promise<{ url: string; id: string }> {
    const tenorApiKey = process.env.RAVEN_TENOR_KEY;
    if (!tenorApiKey) {
      this.logger.error('Tenor API key is not configured');
      throw new HttpException(
        {
          message: MEDIA_MESSAGES.GIF_UPLOAD_FAILED,
          code: MEDIA_CODES.GIF_UPLOAD_FAILED,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const tenorUrl = `https://tenor.googleapis.com/v2/posts?key=${tenorApiKey}&ids=${tenorId}&client_key=my_app`;
    this.logger.log(`Fetching GIF from Tenor with ID: ${tenorId}`);

    const tenorResponse = await fetch(tenorUrl);

    if (!tenorResponse.ok) {
      throw new Error(`Tenor API request failed: ${tenorResponse.statusText}`);
    }

    const tenorData = (await tenorResponse.json()) as TenorResponse;
    console.log({ tenorData });

    if ((tenorData && !tenorData.results) || tenorData.results.length === 0) {
      throw new HttpException(
        {
          message: MEDIA_MESSAGES.GIF_NOT_FOUND,
          code: MEDIA_CODES.GIF_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const gifData = tenorData.results[0];

    // Get the GIF URL and dimensions from the response
    const gifUrl = gifData.media_formats.gif.url;
    const [width, height] = gifData.media_formats.gif.dims;

    this.logger.log(`GIF URL from Tenor: ${gifUrl}`);

    // Save metadata to database
    const mediaDto: MediaDto = {
      userId: currentUserId,
      url: gifUrl,
      type: MediaType.GIF,
      width,
      height,
      altText: gifData.content_description,
      pending: true,
    };

    const savedMedia = await this.mediaRepository.saveMedia(mediaDto);

    this.logger.log(`GIF metadata saved with ID: ${savedMedia.id}`);

    return { url: gifUrl, id: savedMedia.id.toString() };
  }

  /**
   * Cleanup pending media that has exceeded the threshold time.
   * Runs weekly to delete orphaned media from failed tweet creations.
   *
   * This job finds all media records where:
   * - pending = true
   * - createdAt is older than the threshold
   *
   * For each found record, it deletes the file from S3 and the record from the database.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanUpPendingMedia() {
    this.logger.log('Starting cleanup of pending media...');

    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - PENDING_MEDIA_CLEANUP_THRESHOLD_HOURS);

    this.logger.log(`Threshold date for cleanup: ${thresholdDate.toISOString()}`);

    // Find pending media older than the threshold
    const pendingMediaRecords = await this.mediaRepository.findPendingMediaOlderThan(thresholdDate);

    if (pendingMediaRecords.length === 0) {
      this.logger.log('No pending media found for cleanup');
      return;
    }

    this.logger.log(`Found ${pendingMediaRecords.length} pending media records to clean up`);

    for (const media of pendingMediaRecords) {
      try {
        // Delete from database
        await this.mediaRepository.deleteMedia(media.id);
        this.logger.debug(`Deleted pending media record from database: ID ${media.id}`);

        // Delete from S3
        const key = this.s3Service.extractKeyFromUrl(media.url);
        await this.s3Service.deleteFile(key);
        this.logger.debug(`Deleted pending media from S3: ${media.url}`);
      } catch (error) {
        this.logger.error(
          `Failed to clean up pending media ID ${media.id} URL ${media.url}: ${error}`,
        );
      }
    }
  }
}
