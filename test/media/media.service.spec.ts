import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediaService } from 'src/media/media.service';
import { MediaUrlService } from 'src/common/media-url';
import { S3Service } from 'src/media/s3/s3.service';
import { MediaRepository } from 'src/media/media.repository';
import { HttpException, HttpStatus } from '@nestjs/common';
import { MediaFolder } from 'src/media/enums';
import { MediaType } from '@prisma/client';
import { Readable } from 'stream';
import * as sharp from 'sharp';

import { detectMediaType } from 'src/media/utils';
import {
  MEDIA_CODES,
  MEDIA_MESSAGES,
  PENDING_MEDIA_CLEANUP_THRESHOLD_HOURS,
} from 'src/media/constants';

// Mock sharp
jest.mock('sharp');

// Mock the detectMediaType utility - use lazy evaluation to avoid initialization issues
jest.mock('src/media/utils/detect-media-type.util', () => ({
  detectMediaType: jest.fn(() => MediaType.IMAGE),
}));

const CDN_URL = 'https://cdn.example.com';

const mockConfigService = {
  get: jest.fn((key: string) => (key === 'CDN_URL' ? CDN_URL : undefined)),
};

const mockS3Service = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
};

const mockMediaRepository = {
  saveMedia: jest.fn(),
  deleteMedia: jest.fn(),
  findByUrl: jest.fn(),
  findPendingMediaOlderThan: jest.fn(),
};

const createMockFile = (overrides?: Partial<Express.Multer.File>): Express.Multer.File => ({
  originalname: 'file.jpg',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from('file content'),
  fieldname: 'file',
  filename: 'file.jpg',
  path: '/tmp/file.jpg',
  encoding: '7bit',
  stream: new Readable(),
  destination: '/tmp',
  ...overrides,
});

const mockSharpInstance = {
  metadata: jest.fn().mockResolvedValue({
    width: 100,
    height: 100,
    format: 'jpeg',
  }),
  resize: jest.fn().mockReturnThis(),
  rotate: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed image')),
};

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: S3Service, useValue: mockS3Service },
        { provide: MediaRepository, useValue: mockMediaRepository },
        MediaUrlService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  describe('uploadAndSaveMedia', () => {
    it('should upload file to S3 and save metadata to database', async () => {
      // Arrange
      const mockFile = createMockFile();
      const userId = BigInt(1);
      const folder = MediaFolder.AVATARS;
      const mockS3Response = { key: 'avatars/file.jpg' };
      const mockSavedMedia = {
        id: BigInt(1),
        userId,
        url: mockS3Response.key,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
      };
      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockResolvedValue({ width: 100, height: 100 });
      mockS3Service.uploadFile.mockResolvedValue(mockS3Response);
      mockMediaRepository.saveMedia.mockResolvedValue(mockSavedMedia);

      // Act
      const result = await service.uploadAndSaveMedia(mockFile, userId, folder);

      // Assert
      expect(result).toEqual({ id: mockSavedMedia.id.toString(), url: mockS3Response.key });
      expect(mockS3Service.uploadFile).toHaveBeenCalledWith({ file: mockFile, folder });
      expect(mockMediaRepository.saveMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          url: mockS3Response.key,
          type: MediaType.IMAGE,
          width: 100,
          height: 100,
          altText: undefined,
        }),
      );
    });

    it('should handle non-image media types (0 dimensions)', async () => {
      // Arrange
      const mockFile = createMockFile({ mimetype: 'video/mp4' });
      const userId = BigInt(1);
      const folder = MediaFolder.TWEETS;
      const mockS3Response = { key: 'tweets/video.mp4' };
      const mockSavedMedia = {
        id: BigInt(2),
        userId,
        url: mockS3Response.key,
        type: MediaType.VIDEO,
        width: 0,
        height: 0,
        altText: null,
      };
      (detectMediaType as jest.Mock).mockReturnValue(MediaType.VIDEO);
      mockS3Service.uploadFile.mockResolvedValue(mockS3Response);
      mockMediaRepository.saveMedia.mockResolvedValue(mockSavedMedia);

      // Act
      const result = await service.uploadAndSaveMedia(mockFile, userId, folder);

      // Assert
      expect(result).toEqual({ id: mockSavedMedia.id.toString(), url: mockS3Response.key });
      expect(mockMediaRepository.saveMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MediaType.VIDEO,
          width: 0,
          height: 0,
        }),
      );
    });

    it('should rollback S3 upload when database save fails', async () => {
      // Arrange
      const mockFile = createMockFile();
      const userId = BigInt(1);
      const folder = MediaFolder.AVATARS;
      const mockS3Response = { key: 'avatars/file.jpg' };
      const dbError = new Error('Database connection failed');

      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockResolvedValue({ width: 100, height: 100 });
      mockS3Service.uploadFile.mockResolvedValue(mockS3Response);
      mockMediaRepository.saveMedia.mockRejectedValue(dbError);
      mockS3Service.deleteFile.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.uploadAndSaveMedia(mockFile, userId, folder)).rejects.toThrow(
        new HttpException(
          {
            message: MEDIA_MESSAGES.MEDIA_UPLOAD_SAVE_FAILED,
            code: MEDIA_CODES.MEDIA_UPLOAD_SAVE_FAILED,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      // Fixed: Moved assertion inside the test
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith('avatars/file.jpg');
    });

    it('should handle rollback failure when S3 deletion fails during rollback', async () => {
      // Arrange
      const mockFile = createMockFile();
      const userId = BigInt(1);
      const folder = MediaFolder.AVATARS;
      const mockS3Response = { key: 'avatars/file.jpg' };
      const dbError = new Error('Database connection failed');
      const rollbackError = new Error('S3 rollback failed');

      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockResolvedValue({ width: 100, height: 100 });
      mockS3Service.uploadFile.mockResolvedValue(mockS3Response);
      mockMediaRepository.saveMedia.mockRejectedValue(dbError);
      mockS3Service.deleteFile.mockRejectedValue(rollbackError);

      // Act & Assert
      await expect(service.uploadAndSaveMedia(mockFile, userId, folder)).rejects.toThrow(
        new HttpException(
          {
            message: MEDIA_MESSAGES.MEDIA_UPLOAD_SAVE_FAILED,
            code: MEDIA_CODES.MEDIA_UPLOAD_SAVE_FAILED,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      // Verify rollback was attempted
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith('avatars/file.jpg');
    });

    it('should handle image dimensions retrieval failure', async () => {
      const mockFile = createMockFile();
      const userId = BigInt(1);
      const folder = MediaFolder.AVATARS;
      const mockS3Response = { key: 'avatars/file.jpg' };
      const mockSavedMedia = {
        id: BigInt(1),
        userId,
        url: mockS3Response.key,
        type: MediaType.IMAGE,
        width: 0,
        height: 0,
        altText: null,
      };

      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockRejectedValue(new Error('Invalid image'));
      mockS3Service.uploadFile.mockResolvedValue(mockS3Response);
      mockMediaRepository.saveMedia.mockResolvedValue(mockSavedMedia);

      const result = await service.uploadAndSaveMedia(mockFile, userId, folder);

      expect(result).toEqual({ id: mockSavedMedia.id.toString(), url: mockS3Response.key });
      expect(mockMediaRepository.saveMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 0,
          height: 0,
        }),
      );
    });
  });

  describe('getImageDimensions (private method)', () => {
    it('should successfully get image dimensions', async () => {
      const mockFile = createMockFile();
      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockResolvedValue({ width: 800, height: 600 });

      // Access private method using type assertion
      const result = await service.getImageDimensions(mockFile);

      expect(result).toEqual({ width: 800, height: 600 });
      expect(sharp).toHaveBeenCalledWith(mockFile.buffer);
    });

    it('should return zero dimensions when metadata extraction fails', async () => {
      const mockFile = createMockFile();
      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockRejectedValue(new Error('Invalid image format'));

      // Access private method using type assertion
      const result = await service.getImageDimensions(mockFile);

      expect(result).toEqual({ width: 0, height: 0 });
    });

    it('should handle null width and height from metadata', async () => {
      const mockFile = createMockFile();
      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockResolvedValue({ width: null, height: null });

      // Access private method using type assertion
      const result = await service.getImageDimensions(mockFile);

      expect(result).toEqual({ width: 0, height: 0 });
    });
  });

  describe('uploadAvatarOrBanner', () => {
    it('should upload both avatar and banner', async () => {
      // Arrange
      const mockAvatarFile = createMockFile({ originalname: 'avatar.jpg' });
      const mockBannerFile = createMockFile({ originalname: 'banner.jpg' });
      const userId = BigInt(1);
      const altText = 'Profile media';

      const avatarS3Response = { key: 'avatars/avatar.jpg' };
      const bannerS3Response = { key: 'banners/banner.jpg' };

      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockResolvedValue({ width: 100, height: 100 });

      mockS3Service.uploadFile
        .mockResolvedValueOnce(avatarS3Response)
        .mockResolvedValueOnce(bannerS3Response);

      mockMediaRepository.saveMedia
        .mockResolvedValueOnce({
          id: BigInt(1),
          userId,
          url: avatarS3Response.key,
          type: MediaType.IMAGE,
          width: 100,
          height: 100,
          altText,
        })
        .mockResolvedValueOnce({
          id: BigInt(2),
          userId,
          url: bannerS3Response.key,
          type: MediaType.IMAGE,
          width: 100,
          height: 100,
          altText,
        });

      const result = await service.uploadAvatarOrBanner(userId, {
        avatar: mockAvatarFile,
        banner: mockBannerFile,
      });

      // Assert
      expect(result.avatarUrl).toBe(avatarS3Response.key);
      expect(result.bannerUrl).toBe(bannerS3Response.key);
      expect(mockS3Service.uploadFile).toHaveBeenCalledTimes(2);
    });

    it('should upload only avatar when banner is not provided', async () => {
      const mockAvatarFile = createMockFile({ originalname: 'avatar.jpg' });
      const userId = BigInt(1);

      const avatarS3Response = { key: 'avatars/avatar.jpg' };

      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockResolvedValue({ width: 100, height: 100 });

      mockS3Service.uploadFile.mockResolvedValue(avatarS3Response);
      mockMediaRepository.saveMedia.mockResolvedValue({
        id: BigInt(1),
        userId,
        url: avatarS3Response.key,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
      });

      const result = await service.uploadAvatarOrBanner(userId, {
        avatar: mockAvatarFile,
      });

      expect(result.avatarUrl).toBe(avatarS3Response.key);
      expect(result.bannerUrl).toBeNull();
      expect(mockS3Service.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('should upload only banner when avatar is not provided', async () => {
      const mockBannerFile = createMockFile({ originalname: 'banner.jpg' });
      const userId = BigInt(1);

      const bannerS3Response = { key: 'banners/banner.jpg' };

      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockResolvedValue({ width: 100, height: 100 });

      mockS3Service.uploadFile.mockResolvedValue(bannerS3Response);
      mockMediaRepository.saveMedia.mockResolvedValue({
        id: BigInt(2),
        userId,
        url: bannerS3Response.key,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
      });

      const result = await service.uploadAvatarOrBanner(userId, {
        banner: mockBannerFile,
      });

      expect(result.avatarUrl).toBeNull();
      expect(result.bannerUrl).toBe(bannerS3Response.key);
      expect(mockS3Service.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('should throw HttpException when both avatar and banner are missing', async () => {
      const userId = BigInt(1);

      await expect(service.uploadAvatarOrBanner(userId, {})).rejects.toThrow(
        new HttpException(
          {
            message: MEDIA_MESSAGES.NO_FILES_PROVIDED,
            code: MEDIA_CODES.NO_FILES_PROVIDED,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('deleteMedia', () => {
    it('should look the record up by key and delete it from database and S3', async () => {
      // Arrange
      const key = 'avatars/file.jpg';
      const userId = BigInt(1);
      const mockMediaRecord = {
        id: BigInt(1),
        userId,
        url: key,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
      };

      mockMediaRepository.findByUrl.mockResolvedValue(mockMediaRecord);
      mockMediaRepository.deleteMedia.mockResolvedValue(mockMediaRecord);
      mockS3Service.deleteFile.mockResolvedValue(undefined);

      // Act
      await service.deleteMedia(key, userId);

      // Assert
      expect(mockMediaRepository.findByUrl).toHaveBeenCalledWith(key);
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledWith(BigInt(1));
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith(key);
    });

    it('should strip the CDN origin from an absolute URL before looking the record up', async () => {
      // Arrange
      const key = 'avatars/file.jpg';
      const userId = BigInt(1);
      const mockMediaRecord = {
        id: BigInt(1),
        userId,
        url: key,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
      };

      mockMediaRepository.findByUrl.mockResolvedValue(mockMediaRecord);
      mockMediaRepository.deleteMedia.mockResolvedValue(mockMediaRecord);
      mockS3Service.deleteFile.mockResolvedValue(undefined);

      // Act
      await service.deleteMedia(`${CDN_URL}/${key}`, userId);

      // Assert
      expect(mockMediaRepository.findByUrl).toHaveBeenCalledWith(key);
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith(key);
    });

    it('should skip S3 deletion for externally hosted media', async () => {
      // Arrange
      const url = 'https://media.tenor.com/test.gif';
      const userId = BigInt(1);
      const mockMediaRecord = {
        id: BigInt(1),
        userId,
        url,
        type: MediaType.GIF,
        width: 100,
        height: 100,
        altText: null,
      };

      mockMediaRepository.findByUrl.mockResolvedValue(mockMediaRecord);
      mockMediaRepository.deleteMedia.mockResolvedValue(mockMediaRecord);

      // Act
      await service.deleteMedia(url, userId);

      // Assert
      expect(mockMediaRepository.findByUrl).toHaveBeenCalledWith(url);
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledWith(BigInt(1));
      expect(mockS3Service.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when media record does not exist', async () => {
      // Arrange
      const url = 'avatars/nonexistent.jpg';
      const userId = BigInt(1);

      mockMediaRepository.findByUrl.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteMedia(url, userId)).rejects.toThrow(
        new HttpException(
          {
            message: MEDIA_MESSAGES.MEDIA_NOT_FOUND,
            code: MEDIA_CODES.MEDIA_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );

      expect(mockMediaRepository.deleteMedia).not.toHaveBeenCalled();
      expect(mockS3Service.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user does not own the media', async () => {
      // Arrange
      const url = 'avatars/file.jpg';
      const userId = BigInt(1);
      const differentUserId = BigInt(2);
      const mockMediaRecord = {
        id: BigInt(1),
        userId: differentUserId,
        url,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
      };

      mockMediaRepository.findByUrl.mockResolvedValue(mockMediaRecord);

      // Act & Assert
      await expect(service.deleteMedia(url, userId)).rejects.toThrow(
        new HttpException(
          {
            message: MEDIA_MESSAGES.UNAUTHORIZED_DELETE,
            code: MEDIA_CODES.UNAUTHORIZED_DELETE,
          },
          HttpStatus.FORBIDDEN,
        ),
      );

      expect(mockMediaRepository.deleteMedia).not.toHaveBeenCalled();
      expect(mockS3Service.deleteFile).not.toHaveBeenCalled();
    });

    it('should rollback database deletion when S3 deletion fails', async () => {
      // Arrange
      const url = 'avatars/file.jpg';
      const userId = BigInt(1);
      const mockMediaRecord = {
        id: BigInt(1),
        userId,
        url,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
        pending: false,
      };
      const s3Error = new Error('S3 deletion failed');

      mockMediaRepository.findByUrl.mockResolvedValue(mockMediaRecord);
      mockMediaRepository.deleteMedia.mockResolvedValue(mockMediaRecord);
      mockS3Service.deleteFile.mockRejectedValue(s3Error);
      mockMediaRepository.saveMedia.mockResolvedValue(mockMediaRecord);

      // Act & Assert
      await expect(service.deleteMedia(url, userId)).rejects.toThrow(
        new Error('S3 deletion failed'),
      );

      // Verify rollback was attempted
      expect(mockMediaRepository.saveMedia).toHaveBeenCalledWith({
        userId: mockMediaRecord.userId,
        url: mockMediaRecord.url,
        type: mockMediaRecord.type,
        width: mockMediaRecord.width,
        height: mockMediaRecord.height,
        altText: undefined,
        pending: mockMediaRecord.pending,
      });
    });

    it('should handle rollback failure when restoring media metadata fails', async () => {
      // Arrange
      const url = 'avatars/file.jpg';
      const userId = BigInt(1);
      const mockMediaRecord = {
        id: BigInt(1),
        userId,
        url,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
        pending: false,
      };
      const s3Error = new Error('S3 deletion failed');
      const rollbackError = new Error('Database restore failed');

      mockMediaRepository.findByUrl.mockResolvedValue(mockMediaRecord);
      mockMediaRepository.deleteMedia.mockResolvedValue(mockMediaRecord);
      mockS3Service.deleteFile.mockRejectedValue(s3Error);
      mockMediaRepository.saveMedia.mockRejectedValue(rollbackError);

      // Act & Assert
      await expect(service.deleteMedia(url, userId)).rejects.toThrow(
        new Error('S3 deletion failed'),
      );

      // Verify rollback was attempted
      expect(mockMediaRepository.saveMedia).toHaveBeenCalled();
    });
  });

  describe('uploadMedia', () => {
    it('should throw a bad request error when file is not provided', async () => {
      const error = new HttpException(
        {
          message: MEDIA_MESSAGES.NO_FILES_PROVIDED,
          code: MEDIA_CODES.NO_FILES_PROVIDED,
        },
        HttpStatus.BAD_REQUEST,
      );
      await expect(() =>
        service.uploadMedia(
          BigInt(1),
          undefined as unknown as Express.Multer.File,
          MediaFolder.AVATARS,
        ),
      ).rejects.toThrow(error);
    });

    it('should call uploadAndSaveMedia with correct parameters', async () => {
      // Arrange
      const userId = BigInt(1);
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 100,
      } as unknown as Express.Multer.File;
      const folder = MediaFolder.AVATARS;
      const altText = 'Test image';

      const expectedResult = { url: 'http://example.com/test.jpg', id: '1' };
      const uploadAndSaveMediaSpy = jest
        .spyOn(service, 'uploadAndSaveMedia')
        .mockResolvedValue(expectedResult);

      // Act
      const result = await service.uploadMedia(userId, file, folder, altText);

      // Assert
      expect(uploadAndSaveMediaSpy).toHaveBeenCalledWith(file, userId, folder, altText, true);
      expect(result).toEqual({
        ...expectedResult,
        message: 'Media uploaded successfully.',
      });
    });
  });

  describe('uploadGif', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
      global.fetch = jest.fn();
    });

    afterEach(() => {
      process.env = originalEnv;
      jest.restoreAllMocks();
    });

    it('should throw error when RAVEN_TENOR_KEY is not configured', async () => {
      // Arrange
      delete process.env.RAVEN_TENOR_KEY;
      const userId = BigInt(1);
      const tenorId = 'test-tenor-id';

      // Act & Assert
      await expect(service.uploadGif(userId, tenorId)).rejects.toThrow(
        new HttpException(
          {
            message: MEDIA_MESSAGES.GIF_UPLOAD_FAILED,
            code: MEDIA_CODES.GIF_UPLOAD_FAILED,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        ),
      );
    });

    it('should throw error when Tenor API request fails', async () => {
      // Arrange
      process.env.RAVEN_TENOR_KEY = 'test-api-key';
      const userId = BigInt(1);
      const tenorId = 'test-tenor-id';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
      });

      // Act & Assert
      await expect(service.uploadGif(userId, tenorId)).rejects.toThrow(
        new HttpException(
          {
            message: MEDIA_MESSAGES.GIF_UPLOAD_FAILED,
            code: MEDIA_CODES.GIF_UPLOAD_FAILED,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw error when Tenor returns no results', async () => {
      // Arrange
      process.env.RAVEN_TENOR_KEY = 'test-api-key';
      const userId = BigInt(1);
      const tenorId = 'test-tenor-id';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      // Act & Assert
      await expect(service.uploadGif(userId, tenorId)).rejects.toThrow(
        new HttpException(
          {
            message: MEDIA_MESSAGES.GIF_NOT_FOUND,
            code: MEDIA_CODES.GIF_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw error when Tenor returns null results', async () => {
      // Arrange
      process.env.RAVEN_TENOR_KEY = 'test-api-key';
      const userId = BigInt(1);
      const tenorId = 'test-tenor-id';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      // Act & Assert
      await expect(service.uploadGif(userId, tenorId)).rejects.toThrow(
        new HttpException(
          {
            message: MEDIA_MESSAGES.GIF_NOT_FOUND,
            code: MEDIA_CODES.GIF_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should successfully upload GIF and save metadata', async () => {
      // Arrange
      process.env.RAVEN_TENOR_KEY = 'test-api-key';
      const userId = BigInt(1);
      const tenorId = 'test-tenor-id';
      const mockTenorResponse = {
        results: [
          {
            id: tenorId,
            content_description: 'Happy cat dancing',
            media_formats: {
              gif: {
                url: 'https://media.tenor.com/test.gif',
                dims: [498, 280],
              },
            },
          },
        ],
      };
      const mockSavedMedia = {
        id: BigInt(123),
        userId,
        url: 'https://media.tenor.com/test.gif',
        type: MediaType.GIF,
        width: 498,
        height: 280,
        altText: 'Happy cat dancing',
        pending: true,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTenorResponse),
      });
      mockMediaRepository.saveMedia.mockResolvedValue(mockSavedMedia);

      // Act
      const result = await service.uploadGif(userId, tenorId);

      // Assert
      expect(result).toEqual({
        id: '123',
        url: 'https://media.tenor.com/test.gif',
        width: 498,
        height: 280,
        altText: 'Happy cat dancing',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `https://tenor.googleapis.com/v2/posts?key=test-api-key&ids=${tenorId}&client_key=my_app`,
      );

      expect(mockMediaRepository.saveMedia).toHaveBeenCalledWith({
        userId,
        url: 'https://media.tenor.com/test.gif',
        type: MediaType.GIF,
        width: 498,
        height: 280,
        altText: 'Happy cat dancing',
        pending: true,
      });
    });
  });

  describe('cleanUpPendingMedia', () => {
    it('should do nothing when no pending media is found', async () => {
      // Arrange
      mockMediaRepository.findPendingMediaOlderThan.mockResolvedValue([]);

      // Act
      await service.cleanUpPendingMedia();

      // Assert
      expect(mockMediaRepository.findPendingMediaOlderThan).toHaveBeenCalled();
      expect(mockMediaRepository.deleteMedia).not.toHaveBeenCalled();
      expect(mockS3Service.deleteFile).not.toHaveBeenCalled();
    });

    it('should calculate the correct threshold date', async () => {
      // Arrange
      mockMediaRepository.findPendingMediaOlderThan.mockResolvedValue([]);
      const now = new Date('2023-10-10T12:00:00Z');
      jest.useFakeTimers({ now: now });

      // Act
      await service.cleanUpPendingMedia();

      // Assert
      const expectedThreshold = new Date(now);
      expectedThreshold.setHours(now.getHours() - PENDING_MEDIA_CLEANUP_THRESHOLD_HOURS);

      expect(mockMediaRepository.findPendingMediaOlderThan).toHaveBeenCalledWith(expectedThreshold);

      jest.useRealTimers();
    });

    it('should delete pending media from DB and S3 when found', async () => {
      // Arrange
      const mockPendingMedia = [
        { id: BigInt(1), url: 'avatars/eceda386-4f94-4367-b811-cb52b6ad8767.png' },
        { id: BigInt(2), url: 'tweets/dc347b14-b274-4b07-b18d-0932eefec2c4.png' },
      ];

      mockMediaRepository.findPendingMediaOlderThan.mockResolvedValue(mockPendingMedia);
      mockMediaRepository.deleteMedia.mockResolvedValue(undefined);

      // Act
      await service.cleanUpPendingMedia();

      // Assert
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledTimes(2);
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledWith(BigInt(1));
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledWith(BigInt(2));

      expect(mockS3Service.deleteFile).toHaveBeenCalledTimes(2);
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith(
        'avatars/eceda386-4f94-4367-b811-cb52b6ad8767.png',
      );
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith(
        'tweets/dc347b14-b274-4b07-b18d-0932eefec2c4.png',
      );
    });

    it('should delete externally hosted pending media from the DB only', async () => {
      // Arrange
      const mockPendingMedia = [{ id: BigInt(1), url: 'https://media.tenor.com/test.gif' }];

      mockMediaRepository.findPendingMediaOlderThan.mockResolvedValue(mockPendingMedia);
      mockMediaRepository.deleteMedia.mockResolvedValue(undefined);

      // Act
      await service.cleanUpPendingMedia();

      // Assert
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledWith(BigInt(1));
      expect(mockS3Service.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle error gracefully for individual items and continue processing', async () => {
      // Arrange
      const mockPendingMedia = [
        { id: BigInt(1), url: 'avatars/eceda386-4f94-4367-b811-cb52b6ad8767/fail.png' },
        { id: BigInt(2), url: 'avatars/eceda386-4f94-4367-b811-cb52b6ad8767/success.png' },
      ];

      mockMediaRepository.findPendingMediaOlderThan.mockResolvedValue(mockPendingMedia);

      // First item fails at DB deletion
      mockMediaRepository.deleteMedia
        .mockRejectedValueOnce(new Error('DB Delete Failed'))
        .mockResolvedValueOnce(undefined); // Second succeeds

      // Act
      await expect(service.cleanUpPendingMedia()).resolves.not.toThrow();

      // Assert
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledWith(BigInt(1));
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith(
        'avatars/eceda386-4f94-4367-b811-cb52b6ad8767/success.png',
      );
    });

    it('should handle error when S3 deletion fails during cleanup', async () => {
      // Arrange
      const mockPendingMedia = [{ id: BigInt(1), url: 'avatars/test.png' }];

      mockMediaRepository.findPendingMediaOlderThan.mockResolvedValue(mockPendingMedia);
      mockMediaRepository.deleteMedia.mockResolvedValue(undefined);
      mockS3Service.deleteFile.mockRejectedValue(new Error('S3 deletion failed'));

      // Spy on logger to ensure error is logged
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');

      // Act
      await service.cleanUpPendingMedia();

      // Assert
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledWith(BigInt(1));
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith('avatars/test.png');
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clean up pending media'),
      );
    });
  });
});
