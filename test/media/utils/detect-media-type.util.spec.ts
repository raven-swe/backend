import { MediaType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { detectMediaType } from 'src/media/utils';
import { Readable } from 'stream';

// Mock the validation error utility
jest.mock('src/common/utils/create-validation-error.util', () => ({
  createValidationError: jest.fn((field: string, errors: string[]) => ({
    field,
    errors,
  })),
}));

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

describe('detectMediaType', () => {
  describe('Image Detection by Extension', () => {
    it('should detect JPEG image from .jpg extension', () => {
      const file = createMockFile({
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.IMAGE);
    });

    it('should detect JPEG image from .jpeg extension', () => {
      const file = createMockFile({
        originalname: 'photo.jpeg',
        mimetype: 'image/jpeg',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.IMAGE);
    });

    it('should detect PNG image from .png extension', () => {
      const file = createMockFile({
        originalname: 'image.png',
        mimetype: 'image/png',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.IMAGE);
    });

    it('should detect WebP image from .webp extension', () => {
      const file = createMockFile({
        originalname: 'image.webp',
        mimetype: 'image/webp',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.IMAGE);
    });

    it('should detect GIF specifically from .gif extension', () => {
      const file = createMockFile({
        originalname: 'animation.gif',
        mimetype: 'image/gif',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.GIF);
    });

    it('should handle uppercase extensions', () => {
      const file = createMockFile({
        originalname: 'PHOTO.JPG',
        mimetype: 'image/jpeg',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.IMAGE);
    });

    it('should handle mixed case extensions', () => {
      const file = createMockFile({
        originalname: 'Photo.JpEg',
        mimetype: 'image/jpeg',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.IMAGE);
    });
  });

  describe('Video Detection by Extension', () => {
    it('should detect MP4 video from .mp4 extension', () => {
      const file = createMockFile({
        originalname: 'video.mp4',
        mimetype: 'video/mp4',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.VIDEO);
    });

    it('should detect MKV video from .mkv extension', () => {
      const file = createMockFile({
        originalname: 'movie.mkv',
        mimetype: 'video/x-matroska',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.VIDEO);
    });

    it('should detect WebM video from .webm extension', () => {
      const file = createMockFile({
        originalname: 'clip.webm',
        mimetype: 'video/webm',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.VIDEO);
    });

    it('should detect MOV video from .mov extension', () => {
      const file = createMockFile({
        originalname: 'video.mov',
        mimetype: 'video/quicktime',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.VIDEO);
    });
  });

  describe('MIME Type Fallback Detection', () => {
    it('should fallback to MIME type for image when extension is missing', () => {
      const file = createMockFile({
        originalname: 'photo',
        mimetype: 'image/jpeg',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.IMAGE);
    });

    it('should fallback to MIME type for video when extension is missing', () => {
      const file = createMockFile({
        originalname: 'video',
        mimetype: 'video/mp4',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.VIDEO);
    });

    it('should detect GIF from MIME type when extension is unrecognized', () => {
      const file = createMockFile({
        originalname: 'animation.unknown',
        mimetype: 'image/gif',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.GIF);
    });

    it('should handle uppercase MIME types', () => {
      const file = createMockFile({
        originalname: 'photo.unknown',
        mimetype: 'IMAGE/JPEG',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.IMAGE);
    });
  });

  describe('Edge Cases', () => {
    it('should handle filename with multiple dots', () => {
      const file = createMockFile({
        originalname: 'my.photo.backup.jpg',
        mimetype: 'image/jpeg',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.IMAGE);
    });

    it('should handle filename with no extension and empty string after split', () => {
      const file = createMockFile({
        originalname: 'file.',
        mimetype: 'image/jpeg',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.IMAGE);
    });

    it('should handle empty filename and fallback to MIME type', () => {
      const file = createMockFile({
        originalname: '',
        mimetype: 'image/png',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.IMAGE);
    });

    it('should prioritize extension over conflicting MIME type', () => {
      const file = createMockFile({
        originalname: 'video.mp4',
        mimetype: 'image/jpeg', // Incorrect MIME type
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.VIDEO);
    });
  });

  describe('Error Cases', () => {
    it('should throw BadRequestException for unsupported extension', () => {
      const file = createMockFile({
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
      });

      expect(() => detectMediaType(file)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unsupported MIME type', () => {
      const file = createMockFile({
        originalname: 'document.txt',
        mimetype: 'text/plain',
      });

      expect(() => detectMediaType(file)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException with correct error message for extension', () => {
      const file = createMockFile({
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
      });

      try {
        detectMediaType(file);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toHaveProperty('field', 'file');
        expect(response).toHaveProperty('errors');
      }
    });

    it('should throw BadRequestException for audio files', () => {
      const file = createMockFile({
        originalname: 'song.mp3',
        mimetype: 'audio/mpeg',
      });

      expect(() => detectMediaType(file)).toThrow(BadRequestException);
    });
  });

  describe('GIF Special Handling', () => {
    it('should always return GIF type for .gif extension even with wrong MIME', () => {
      const file = createMockFile({
        originalname: 'animation.gif',
        mimetype: 'image/png', // Wrong MIME type
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.GIF);
    });

    it('should return GIF type from MIME when extension is missing', () => {
      const file = createMockFile({
        originalname: 'animation',
        mimetype: 'image/gif',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.GIF);
    });

    it('should return GIF for uppercase GIF extension', () => {
      const file = createMockFile({
        originalname: 'ANIMATION.GIF',
        mimetype: 'image/gif',
      });

      const result = detectMediaType(file);

      expect(result).toBe(MediaType.GIF);
    });
  });
});
