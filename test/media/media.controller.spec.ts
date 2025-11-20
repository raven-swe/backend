import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from 'src/media/media.controller';
import { MediaService } from 'src/media/media.service';
import { MediaFolder } from 'src/media/enums';
import type { RequestUser } from 'src/common/interfaces';

describe('MediaController', () => {
  let controller: MediaController;

  const mockUser: RequestUser = {
    id: '1',
  } as RequestUser;

  const createMockFile = (filename: string, mimetype: string): Express.Multer.File => ({
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype: mimetype,
    buffer: Buffer.from('test-buffer'),
    size: 1024,
    stream: null as never,
    destination: '',
    filename: filename,
    path: '',
  });

  const mockMediaService = {
    uploadMedia: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadImage', () => {
    it('should upload an image successfully with default folder', async () => {
      // Arrange
      const mockFile = createMockFile('image.jpg', 'image/jpeg');
      const altText = 'A beautiful scenery';
      const expectedResponse = {
        items: {
          url: 'https://cdn.raven.cmp27.space/tweets/dc347b14-b274-4b07-b18d-0932eefec2c4.png',
          id: '100',
        },
        message: 'Media uploaded successfully.',
      };

      mockMediaService.uploadMedia.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.uploadImage(mockUser, mockFile, altText);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockMediaService.uploadMedia).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        mockFile,
        MediaFolder.TWEETS,
        altText,
      );
    });

    it('should upload an image successfully with specific folder', async () => {
      // Arrange
      const mockFile = createMockFile('avatar.png', 'image/png');
      const folder = MediaFolder.AVATARS;
      const expectedResponse = {
        items: {
          url: 'https://cdn.raven.cmp27.space/tweets/dc347b14-b274-4b07-b18d-0932eefec2c4.png',
          id: '1',
        },
        message: 'Success',
      };

      mockMediaService.uploadMedia.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.uploadImage(mockUser, mockFile, undefined, folder);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockMediaService.uploadMedia).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        mockFile,
        folder,
        undefined,
      );
    });

    it('should upload a GIF successfully', async () => {
      // Arrange
      const mockFile = createMockFile('animation.gif', 'image/gif');
      const expectedResponse = {
        items: { url: 'url', id: '1' },
        message: 'Success',
      };

      mockMediaService.uploadMedia.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.uploadImage(mockUser, mockFile);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockMediaService.uploadMedia).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        mockFile,
        MediaFolder.TWEETS,
        undefined,
      );
    });

    it('should propagate errors from the service', async () => {
      // Arrange
      const mockFile = createMockFile('test.jpg', 'image/jpeg');
      const error = new Error('Service failure');
      mockMediaService.uploadMedia.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.uploadImage(mockUser, mockFile)).rejects.toThrow(error);
    });
  });

  describe('uploadVideo', () => {
    it('should upload a video successfully with default folder', async () => {
      // Arrange
      const mockFile = createMockFile('video.mp4', 'video/mp4');
      const altText = 'Funny cat video';
      const expectedResponse = {
        items: {
          url: 'https://cdn.raven.cmp27.space/tweets/dc347b14-b274-4b07-b18d-0932eefec2c4.mp4',
          id: '200',
        },
        message: 'Media uploaded successfully.',
      };

      mockMediaService.uploadMedia.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.uploadVideo(mockUser, mockFile, altText);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockMediaService.uploadMedia).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        mockFile,
        MediaFolder.TWEETS,
        altText,
      );
    });

    it('should upload a video successfully with specific folder', async () => {
      // Arrange
      const mockFile = createMockFile('clip.mp4', 'video/mp4');
      const folder = MediaFolder.MESSAGES;
      const expectedResponse = { items: { url: 'url', id: '1' }, message: 'Success' };

      mockMediaService.uploadMedia.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.uploadVideo(mockUser, mockFile, undefined, folder);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockMediaService.uploadMedia).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        mockFile,
        folder,
        undefined,
      );
    });

    it('should propagate errors from the service', async () => {
      // Arrange
      const mockFile = createMockFile('video.mp4', 'video/mp4');
      const error = new Error('Upload failed');
      mockMediaService.uploadMedia.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.uploadVideo(mockUser, mockFile)).rejects.toThrow(error);
    });
  });
});
