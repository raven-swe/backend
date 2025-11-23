import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from 'src/media/media.service';
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

const mockS3Service = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  extractKeyFromUrl: jest.fn(),
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
      const mockS3Response = {
        key: 'avatars/file.jpg',
        url: 'http://example.com/avatars/file.jpg',
      };
      const mockSavedMedia = {
        id: BigInt(1),
        userId,
        url: mockS3Response.url,
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
      expect(result).toEqual({ id: mockSavedMedia.id.toString(), url: mockS3Response.url });
      expect(mockS3Service.uploadFile).toHaveBeenCalledWith({ file: mockFile, folder });
      expect(mockMediaRepository.saveMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          url: mockS3Response.url,
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
      const mockS3Response = {
        key: 'tweets/video.mp4',
        url: 'http://example.com/tweets/video.mp4',
      };
      const mockSavedMedia = {
        id: BigInt(2),
        userId,
        url: mockS3Response.url,
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
      expect(result).toEqual({ id: mockSavedMedia.id.toString(), url: mockS3Response.url });
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
      const mockS3Response = {
        key: 'avatars/file.jpg',
        url: 'http://example.com/avatars/file.jpg',
      };
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

    it('should handle image dimensions retrieval failure', async () => {
      const mockFile = createMockFile();
      const userId = BigInt(1);
      const folder = MediaFolder.AVATARS;
      const mockS3Response = {
        key: 'avatars/file.jpg',
        url: 'http://example.com/avatars/file.jpg',
      };
      const mockSavedMedia = {
        id: BigInt(1),
        userId,
        url: mockS3Response.url,
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

      expect(result).toEqual({ id: mockSavedMedia.id.toString(), url: mockS3Response.url });
      expect(mockMediaRepository.saveMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 0,
          height: 0,
        }),
      );
    });
  });

  describe('uploadAvatarOrBanner', () => {
    it('should upload both avatar and banner', async () => {
      // Arrange
      const mockAvatarFile = createMockFile({ originalname: 'avatar.jpg' });
      const mockBannerFile = createMockFile({ originalname: 'banner.jpg' });
      const userId = BigInt(1);
      const altText = 'Profile media';

      const avatarS3Response = {
        key: 'avatars/avatar.jpg',
        url: 'http://example.com/avatars/avatar.jpg',
      };
      const bannerS3Response = {
        key: 'banners/banner.jpg',
        url: 'http://example.com/banners/banner.jpg',
      };

      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockResolvedValue({ width: 100, height: 100 });

      mockS3Service.uploadFile
        .mockResolvedValueOnce(avatarS3Response)
        .mockResolvedValueOnce(bannerS3Response);

      mockMediaRepository.saveMedia
        .mockResolvedValueOnce({
          id: BigInt(1),
          userId,
          url: avatarS3Response.url,
          type: MediaType.IMAGE,
          width: 100,
          height: 100,
          altText,
        })
        .mockResolvedValueOnce({
          id: BigInt(2),
          userId,
          url: bannerS3Response.url,
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
      expect(result.avatarUrl).toBe(avatarS3Response.url);
      expect(result.bannerUrl).toBe(bannerS3Response.url);
      expect(mockS3Service.uploadFile).toHaveBeenCalledTimes(2);
    });

    it('should upload only avatar when banner is not provided', async () => {
      const mockAvatarFile = createMockFile({ originalname: 'avatar.jpg' });
      const userId = BigInt(1);

      const avatarS3Response = {
        key: 'avatars/avatar.jpg',
        url: 'http://example.com/avatars/avatar.jpg',
      };

      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockResolvedValue({ width: 100, height: 100 });

      mockS3Service.uploadFile.mockResolvedValue(avatarS3Response);
      mockMediaRepository.saveMedia.mockResolvedValue({
        id: BigInt(1),
        userId,
        url: avatarS3Response.url,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
      });

      const result = await service.uploadAvatarOrBanner(userId, {
        avatar: mockAvatarFile,
      });

      expect(result.avatarUrl).toBe(avatarS3Response.url);
      expect(result.bannerUrl).toBeNull();
      expect(mockS3Service.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('should upload only banner when avatar is not provided', async () => {
      const mockBannerFile = createMockFile({ originalname: 'banner.jpg' });
      const userId = BigInt(1);

      const bannerS3Response = {
        key: 'banners/banner.jpg',
        url: 'http://example.com/banners/banner.jpg',
      };

      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
      mockSharpInstance.metadata.mockResolvedValue({ width: 100, height: 100 });

      mockS3Service.uploadFile.mockResolvedValue(bannerS3Response);
      mockMediaRepository.saveMedia.mockResolvedValue({
        id: BigInt(2),
        userId,
        url: bannerS3Response.url,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
      });

      const result = await service.uploadAvatarOrBanner(userId, {
        banner: mockBannerFile,
      });

      expect(result.avatarUrl).toBeNull();
      expect(result.bannerUrl).toBe(bannerS3Response.url);
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
    it('should successfully delete file from database and S3', async () => {
      // Arrange
      const url = 'http://example.com/avatars/file.jpg';
      const userId = BigInt(1);
      const mockMediaRecord = {
        id: BigInt(1),
        userId,
        url,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
      };

      mockMediaRepository.findByUrl.mockResolvedValue(mockMediaRecord);
      mockMediaRepository.deleteMedia.mockResolvedValue(mockMediaRecord);
      mockS3Service.extractKeyFromUrl.mockReturnValue('avatars/file.jpg');
      mockS3Service.deleteFile.mockResolvedValue(undefined);

      // Act
      await service.deleteMedia(url, userId);

      // Assert
      expect(mockMediaRepository.findByUrl).toHaveBeenCalledWith(url);
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledWith(BigInt(1));
      expect(mockS3Service.extractKeyFromUrl).toHaveBeenCalledWith(url);
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith('avatars/file.jpg');
    });

    it('should throw NOT_FOUND when media record does not exist', async () => {
      // Arrange
      const url = 'http://example.com/avatars/nonexistent.jpg';
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
      const url = 'http://example.com/avatars/file.jpg';
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
      const url = 'http://example.com/avatars/file.jpg';
      const userId = BigInt(1);
      const mockMediaRecord = {
        id: BigInt(1),
        userId,
        url,
        type: MediaType.IMAGE,
        width: 100,
        height: 100,
        altText: null,
      };
      const s3Error = new Error('S3 deletion failed');

      mockMediaRepository.findByUrl.mockResolvedValue(mockMediaRecord);
      mockMediaRepository.deleteMedia.mockResolvedValue(mockMediaRecord);
      mockS3Service.extractKeyFromUrl.mockReturnValue('avatars/file.jpg');
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
      });
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
      expect(result).toEqual({ items: expectedResult, message: 'Media uploaded successfully.' });
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
        {
          id: BigInt(1),
          url: 'https://cdn.raven.cmp27.space/avatars/eceda386-4f94-4367-b811-cb52b6ad8767.png',
        },
        {
          id: BigInt(2),
          url: 'https://cdn.raven.cmp27.space/tweets/dc347b14-b274-4b07-b18d-0932eefec2c4.png',
        },
      ];

      mockMediaRepository.findPendingMediaOlderThan.mockResolvedValue(mockPendingMedia);
      mockS3Service.extractKeyFromUrl.mockReturnValueOnce('key1').mockReturnValueOnce('key2');
      mockMediaRepository.deleteMedia.mockResolvedValue(undefined);

      // Act
      await service.cleanUpPendingMedia();

      // Assert
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledTimes(2);
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledWith(BigInt(1));
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledWith(BigInt(2));

      expect(mockS3Service.extractKeyFromUrl).toHaveBeenCalledWith(
        'https://cdn.raven.cmp27.space/avatars/eceda386-4f94-4367-b811-cb52b6ad8767.png',
      );
      expect(mockS3Service.extractKeyFromUrl).toHaveBeenCalledWith(
        'https://cdn.raven.cmp27.space/tweets/dc347b14-b274-4b07-b18d-0932eefec2c4.png',
      );

      expect(mockS3Service.deleteFile).toHaveBeenCalledTimes(2);
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith('key1');
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith('key2');
    });

    it('should handle error gracefully for individual items and continue processing', async () => {
      // Arrange
      const mockPendingMedia = [
        {
          id: BigInt(1),
          url: 'https://cdn.raven.cmp27.space/avatars/eceda386-4f94-4367-b811-cb52b6ad8767/fail.png',
        },
        {
          id: BigInt(2),
          url: 'https://cdn.raven.cmp27.space/avatars/eceda386-4f94-4367-b811-cb52b6ad8767/success.png',
        },
      ];

      mockMediaRepository.findPendingMediaOlderThan.mockResolvedValue(mockPendingMedia);

      // First item fails at DB deletion
      mockMediaRepository.deleteMedia
        .mockRejectedValueOnce(new Error('DB Delete Failed'))
        .mockResolvedValueOnce(undefined); // Second succeeds
      mockS3Service.extractKeyFromUrl.mockReturnValue('key2');

      // Act
      await expect(service.cleanUpPendingMedia()).resolves.not.toThrow();

      // Assert
      expect(mockMediaRepository.deleteMedia).toHaveBeenCalledWith(BigInt(1));
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith('key2');
    });
  });
});
