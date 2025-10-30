import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { S3Service } from './s3/s3.service';
import { MediaRepository } from './media.repository';
import { HttpException, HttpStatus } from '@nestjs/common';
import { MediaFolder } from './enums/media-folder.enum';
import { MediaType } from '@prisma/client';
import { Readable } from 'stream';
import * as sharp from 'sharp';

// Mock sharp
jest.mock('sharp');

// Mock the detectMediaType utility - use lazy evaluation to avoid initialization issues
jest.mock('./utils/detect-media-type.util', () => ({
  detectMediaType: jest.fn(() => MediaType.IMAGE),
}));

import { detectMediaType } from './utils/detect-media-type.util';

const mockS3Service = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
};

const mockMediaRepository = {
  saveMedia: jest.fn(),
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
  metadata: jest.fn(),
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
      expect(result).toBe(mockS3Response.url);
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
      expect(result).toBe(mockS3Response.url);
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
            message: 'Failed to upload and save media',
            code: 'MEDIA_UPLOAD_SAVE_FAILED',
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

      expect(result).toBe(mockS3Response.url);
      expect(mockMediaRepository.saveMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 0,
          height: 0,
        }),
      );
    });
  });

  describe('uploadAvatarAndBanner', () => {
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

      const result = await service.uploadAvatarAndBanner(
        userId,
        {
          avatar: [mockAvatarFile],
          banner: [mockBannerFile],
        },
        altText,
      );

      // Assert
      expect(result.message).toBe('Avatar and/or banner uploaded successfully');
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

      const result = await service.uploadAvatarAndBanner(userId, {
        avatar: [mockAvatarFile],
      });

      expect(result.message).toBe('Avatar and/or banner uploaded successfully');
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

      const result = await service.uploadAvatarAndBanner(userId, {
        banner: [mockBannerFile],
      });

      expect(result.message).toBe('Avatar and/or banner uploaded successfully');
      expect(result.avatarUrl).toBeNull();
      expect(result.bannerUrl).toBe(bannerS3Response.url);
      expect(mockS3Service.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('should throw HttpException when both avatar and banner are missing', async () => {
      const userId = BigInt(1);

      await expect(service.uploadAvatarAndBanner(userId, {})).rejects.toThrow(
        new HttpException(
          {
            message: 'No files provided for upload',
            code: 'NO_FILES_PROVIDED',
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });
});
