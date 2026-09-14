import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { MEDIA_STORAGE, MediaStorageError } from './storage';
import type { MediaStorage } from './storage';
import { MediaRepository } from './media.repository';
import { MediaFolder } from './enums';
import sharp from 'sharp';
import { MediaDto } from './dtos';
import { detectMediaType } from './utils';
import { MediaType } from '@prisma/client';
import { processImage } from './utils/process-image.util';
import { MEDIA_CODES, MEDIA_MESSAGES, PENDING_MEDIA_CLEANUP_THRESHOLD_HOURS } from './constants';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KlipyResponse } from './interfaces';
import { UploadedGifResponse } from './dtos/uploaded-gif-response.dto';
import { MediaUrlService } from 'src/common/media-url';
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly mediaRepository: MediaRepository,
    private readonly mediaUrlService: MediaUrlService,
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
   * @returns The CDN-relative key of the uploaded media, which is what callers persist
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

      const { key } = await this.storage.uploadFile({ file, folder });
      uploadedKey = key;

      this.logger.log(`File uploaded to storage with key: ${key}`);

      const mediaDto: MediaDto = {
        userId,
        url: key,
        type: mediaType,
        width,
        height,
        altText,
        pending,
      };

      const savedMedia = await this.mediaRepository.saveMedia(mediaDto);

      this.logger.log(`Media metadata saved with ID: ${savedMedia.id}`);

      return { url: key, id: savedMedia.id.toString() };
    } catch (error) {
      this.logger.error('Failed to upload media', error);

      if (uploadedKey) {
        this.logger.error(`Database save failed, rolling back upload for key: ${uploadedKey}`);
        try {
          await this.storage.deleteFile(uploadedKey);
          this.logger.log(`Successfully rolled back upload: ${uploadedKey}`);
        } catch (rollbackError) {
          this.logger.error(`Failed to rollback upload for key: ${uploadedKey}`, rollbackError);
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

    const key = this.mediaUrlService.toRelative(url);

    try {
      mediaRecord = await this.mediaRepository.findByUrl(key);

      if (!mediaRecord) {
        this.logger.error(`Media record not found for key: ${key}`);
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

      // Delete from storage, unless the media lives on another host
      if (this.mediaUrlService.isAbsolute(key)) {
        this.logger.log(`Skipping storage deletion for externally hosted media: ${key}`);
      } else {
        await this.storage.deleteFile(key);
        this.logger.log(`Successfully deleted media from storage: ${key}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete media metadata: ${error}`);

      // Rollback if the storage deletion failed, to restore the DB record
      if (mediaRecord && error instanceof MediaStorageError) {
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
  async getImageDimensions(file: Express.Multer.File): Promise<{ width: number; height: number }> {
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

  async uploadGif(currentUserId: bigint, klipyId: string): Promise<UploadedGifResponse> {
    const klipyApiKey = process.env.RAVEN_KLIPY_KEY;
    if (!klipyApiKey) {
      this.logger.error('KLIPY API key is not configured');
      throw new HttpException(
        {
          message: MEDIA_MESSAGES.GIF_UPLOAD_FAILED,
          code: MEDIA_CODES.GIF_UPLOAD_FAILED,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const klipyUrl = `https://api.klipy.com/v2/posts?key=${klipyApiKey}&ids=${klipyId}&client_key=my_app`;
    this.logger.log(`Fetching GIF from KLIPY with ID: ${klipyId}`);

    const klipyResponse = await fetch(klipyUrl);

    if (!klipyResponse.ok) {
      throw new HttpException(
        {
          message: MEDIA_MESSAGES.GIF_UPLOAD_FAILED,
          code: MEDIA_CODES.GIF_UPLOAD_FAILED,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const klipyData = (await klipyResponse.json()) as KlipyResponse;

    if ((klipyData && !klipyData.results) || klipyData.results.length === 0) {
      throw new HttpException(
        {
          message: MEDIA_MESSAGES.GIF_NOT_FOUND,
          code: MEDIA_CODES.GIF_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const gifData = klipyData.results[0];

    // Get the GIF URL and dimensions from the response
    const gifUrl = gifData.media_formats.gif.url;
    const [width, height] = gifData.media_formats.gif.dims;

    this.logger.log(`GIF URL from KLIPY: ${gifUrl}`);

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

    const uploadedGifResponse = {
      id: savedMedia.id.toString(),
      url: gifUrl,
      width,
      height,
      altText: gifData.content_description,
    };

    this.logger.log(`GIF metadata saved with ID: ${savedMedia.id}`);

    return uploadedGifResponse;
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

        // Delete from storage, unless the media lives on another host
        if (this.mediaUrlService.isAbsolute(media.url)) {
          this.logger.debug(`Skipping storage deletion for externally hosted media: ${media.url}`);
        } else {
          await this.storage.deleteFile(media.url);
          this.logger.debug(`Deleted pending media from storage: ${media.url}`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to clean up pending media ID ${media.id} URL ${media.url}: ${error}`,
        );
      }
    }
  }
}
