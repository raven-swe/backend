import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service } from 'src/media/s3/s3.service';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
}));

const mockS3Client = {
  send: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      SPACES_BUCKET: 'test-bucket',
      SPACES_REGION: 'nyc3',
      CDN_URL: 'https://cdn.example.com',
      SPACES_ENDPOINT: 'https://nyc3.digitaloceanspaces.com',
      SPACES_KEY: 'test-access-key',
      SPACES_SECRET: 'test-secret-key',
    };
    return config[key];
  }),
};

const createMockFile = (overrides?: Partial<Express.Multer.File>): Express.Multer.File => ({
  originalname: 'test-file.jpg',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from('test file content'),
  fieldname: 'file',
  filename: 'test-file.jpg',
  path: '/tmp/test-file.jpg',
  encoding: '7bit',
  stream: new Readable(),
  destination: '/tmp',
  ...overrides,
});

describe('S3Service', () => {
  let service: S3Service;

  beforeEach(async () => {
    // Mock S3Client constructor to return our mockS3Client
    (S3Client as jest.Mock).mockImplementation(() => mockS3Client);

    const module: TestingModule = await Test.createTestingModule({
      providers: [S3Service, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize S3Client with correct configuration', () => {
      expect(S3Client).toHaveBeenCalledWith({
        forcePathStyle: false,
        region: 'nyc3',
        endpoint: 'https://nyc3.digitaloceanspaces.com',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });

    it('should throw error when credentials are missing', () => {
      const invalidConfigService = {
        get: jest.fn((key: string) => {
          const config: Record<string, string | undefined> = {
            SPACES_BUCKET: 'test-bucket',
            SPACES_REGION: 'nyc3',
            SPACES_ENDPOINT: undefined,
            SPACES_KEY: undefined,
            SPACES_SECRET: undefined,
          };
          return config[key];
        }),
      };

      expect(() => {
        new S3Service(invalidConfigService as never);
      }).toThrow(
        'S3 credentials (endpoint, access key, or secret key) are not configured properly.',
      );
    });
  });

  describe('uploadFile', () => {
    it('should upload file successfully and return the file URL and key', async () => {
      // Arrange
      const mockFile = createMockFile();
      const folder = 'avatars';

      mockS3Client.send.mockResolvedValue({});

      // Act
      const result = await service.uploadFile({ file: mockFile, folder });

      // Assert
      expect(result).toEqual({
        key: 'avatars/mock-uuid-1234.jpg',
        url: 'https://cdn.example.com/avatars/mock-uuid-1234.jpg',
      });

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(result.key).toBe('avatars/mock-uuid-1234.jpg');
      expect(result.url).toBe('https://cdn.example.com/avatars/mock-uuid-1234.jpg');
    });

    it('should upload file with custom filename', async () => {
      // Arrange
      const mockFile = createMockFile();
      const folder = 'banners';
      const customFileName = 'custom-banner';

      mockS3Client.send.mockResolvedValue({});

      // Act
      const result = await service.uploadFile({
        file: mockFile,
        folder,
        fileName: customFileName,
      });

      // Assert
      expect(result).toEqual({
        key: 'banners/custom-banner.jpg',
        url: 'https://cdn.example.com/banners/custom-banner.jpg',
      });
    });

    it('should handle files with multiple dots in filename', async () => {
      // Arrange
      const mockFile = createMockFile({ originalname: 'my.test.file.png' });
      const folder = 'uploads';

      mockS3Client.send.mockResolvedValue({});

      // Act
      const result = await service.uploadFile({ file: mockFile, folder });

      // Assert
      expect(result.key).toBe('uploads/mock-uuid-1234.png');
    });

    it('should handle files without extension', async () => {
      // Arrange
      const mockFile = createMockFile({ originalname: 'filename' });
      const folder = 'documents';

      mockS3Client.send.mockResolvedValue({});

      // Act
      const result = await service.uploadFile({ file: mockFile, folder });

      // Assert
      expect(result.key).toBe('documents/mock-uuid-1234.filename');
    });

    it('should throw error when upload fails', async () => {
      // Arrange
      const mockFile = createMockFile();
      const folder = 'avatars';
      const uploadError = new Error('S3 upload failed');

      // Act
      mockS3Client.send.mockRejectedValue(uploadError);

      // Assert
      await expect(service.uploadFile({ file: mockFile, folder })).rejects.toThrow(uploadError);
    });

    it('should upload different file types correctly', async () => {
      // Arrange
      const mockVideoFile = createMockFile({
        originalname: 'video.mp4',
        mimetype: 'video/mp4',
      });
      const folder = 'videos';

      mockS3Client.send.mockResolvedValue({});

      // Act
      const result = await service.uploadFile({ file: mockVideoFile, folder });

      // Assert
      expect(result).toEqual({
        key: 'videos/mock-uuid-1234.mp4',
        url: 'https://cdn.example.com/videos/mock-uuid-1234.mp4',
      });
    });

    it('should throw error when deletion fails', async () => {
      // Arrange
      const key = 'avatars/test-file.jpg';
      const deleteError = new Error('S3 deletion failed');

      mockS3Client.send.mockRejectedValue(deleteError);

      // Assert
      await expect(service.deleteFile(key)).rejects.toThrow(deleteError);
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      // Arrange
      const key = 'avatars/test-file.jpg';

      mockS3Client.send.mockResolvedValue({
        ContentLength: 1024,
        ContentType: 'image/jpeg',
      });

      // Act
      const result = await service.fileExists(key);

      // Assert
      expect(result).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
    });

    it('should throw error when check fails', async () => {
      // Arrange
      const key = 'avatars/test-file.jpg';
      const checkError = new Error('Not Found');

      mockS3Client.send.mockRejectedValue(checkError);

      // Act & Assert
      await expect(service.fileExists(key)).rejects.toThrow(
        'Failed to check file existence: Not Found',
      );
    });
  });

  describe('getPublicUrl', () => {
    it('should return correct CDN URL', () => {
      const key = 'avatars/test-file.jpg';

      const url = service.getPublicUrl(key);

      expect(url).toBe('https://cdn.example.com/avatars/test-file.jpg');
    });

    it('should handle keys with special characters', () => {
      const key = 'folder/subfolder/file with spaces.jpg';

      const url = service.getPublicUrl(key);

      expect(url).toBe('https://cdn.example.com/folder/subfolder/file with spaces.jpg');
    });

    it('should handle keys starting with slash', () => {
      const key = '/avatars/test-file.jpg';

      const url = service.getPublicUrl(key);

      expect(url).toBe('https://cdn.example.com//avatars/test-file.jpg');
    });
  });

  describe('extractKeyFromUrl', () => {
    it('should extract key from full CDN URL', () => {
      const url = 'https://cdn.example.com/avatars/test-file.jpg';

      const key = service.extractKeyFromUrl(url);

      expect(key).toBe('avatars/test-file.jpg');
    });

    it('should extract key from URL without CDN prefix', () => {
      const url = 'https://otherdomain.com/avatars/test-file.jpg';

      const key = service.extractKeyFromUrl(url);

      expect(key).toBe('avatars/test-file.jpg');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      // Arrange
      const key = 'avatars/test-file.jpg';

      mockS3Client.send.mockResolvedValue({});

      // Act
      await service.deleteFile(key);

      // Assert
      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it('should throw error when deletion fails', async () => {
      // Arrange
      const key = 'avatars/test-file.jpg';
      const deleteError = new Error('S3 deletion failed');

      mockS3Client.send.mockRejectedValue(deleteError);

      // Act & Assert
      await expect(service.deleteFile(key)).rejects.toThrow(deleteError);
    });
  });
});
