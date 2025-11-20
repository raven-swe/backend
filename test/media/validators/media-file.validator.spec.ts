import { BadRequestException } from '@nestjs/common';
import { imageFileFilter, videoFileFilter } from 'src/media/validators/media-file.validator';

describe('Media File Validators', () => {
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

  describe('imageFileFilter', () => {
    it('should accept valid image extensions (jpg)', () => {
      const mockFile = createMockFile('image.jpg', 'image/jpeg');
      const mockCallback = jest.fn();

      imageFileFilter(null as never, mockFile, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    it('should accept valid image extensions (png)', () => {
      const mockFile = createMockFile('image.png', 'image/png');
      const mockCallback = jest.fn();

      imageFileFilter(null as never, mockFile, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    it('should accept GIF extensions', () => {
      const mockFile = createMockFile('animation.gif', 'image/gif');
      const mockCallback = jest.fn();

      imageFileFilter(null as never, mockFile, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    it('should handle uppercase extensions', () => {
      const mockFile = createMockFile('IMAGE.JPG', 'image/jpeg');
      const mockCallback = jest.fn();

      imageFileFilter(null as never, mockFile, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    it('should reject files without extensions', () => {
      const mockFile = createMockFile('filenamewithoutextension', 'image/jpeg');
      const mockCallback = jest.fn();

      imageFileFilter(null as never, mockFile, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    });

    it('should reject video files', () => {
      const mockFile = createMockFile('video.mp4', 'video/mp4');
      const mockCallback = jest.fn();

      imageFileFilter(null as never, mockFile, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    });
  });

  describe('videoFileFilter', () => {
    it('should accept valid video extensions (mp4)', () => {
      const mockFile = createMockFile('video.mp4', 'video/mp4');
      const mockCallback = jest.fn();

      videoFileFilter(null as never, mockFile, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    it('should accept valid video extensions (mov)', () => {
      const mockFile = createMockFile('video.mov', 'video/quicktime');
      const mockCallback = jest.fn();

      videoFileFilter(null as never, mockFile, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    it('should handle uppercase video extensions', () => {
      const mockFile = createMockFile('VIDEO.MP4', 'video/mp4');
      const mockCallback = jest.fn();

      videoFileFilter(null as never, mockFile, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    it('should reject files without extensions', () => {
      const mockFile = createMockFile('videofile', 'video/mp4');
      const mockCallback = jest.fn();

      videoFileFilter(null as never, mockFile, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    });

    it('should reject image files uploaded to video endpoint', () => {
      const mockFile = createMockFile('image.jpg', 'image/jpeg');
      const mockCallback = jest.fn();

      videoFileFilter(null as never, mockFile, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    });
  });
});
