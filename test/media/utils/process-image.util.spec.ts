import { processImage } from 'src/media/utils';
import { Readable } from 'stream';
import * as sharp from 'sharp';
import { MAX_HEIGHT, MAX_WIDTH } from 'src/media/constants';

jest.mock('sharp');

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

describe('processImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
    mockSharpInstance.metadata.mockResolvedValue({
      width: 100,
      height: 100,
      format: 'jpeg',
    });
  });

  it('should process image without resizing if within limits', async () => {
    const mockFile = createMockFile();

    mockSharpInstance.metadata.mockResolvedValue({
      width: 1000,
      height: 1000,
      format: 'jpeg',
    });

    const result = await processImage(mockFile);

    expect(result.buffer).toEqual(Buffer.from('processed image'));
    expect(result.width).toBe(1000);
    expect(result.height).toBe(1000);
    expect(mockSharpInstance.resize).not.toHaveBeenCalled();
    expect(mockSharpInstance.jpeg).toHaveBeenCalled();
  });

  it('should resize image if exceeds maximum width', async () => {
    const mockFile = createMockFile();

    mockSharpInstance.metadata.mockResolvedValue({
      width: 3000,
      height: 1500,
      format: 'jpeg',
    });

    await processImage(mockFile);

    expect(mockSharpInstance.resize).toHaveBeenCalledWith(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  });

  it('should resize image if exceeds maximum height', async () => {
    const mockFile = createMockFile();

    mockSharpInstance.metadata.mockResolvedValue({
      width: 1500,
      height: 3000,
      format: 'jpeg',
    });

    await processImage(mockFile);

    expect(mockSharpInstance.resize).toHaveBeenCalledWith(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  });

  it('should use PNG compression for PNG images', async () => {
    const mockFile = createMockFile();

    mockSharpInstance.metadata.mockResolvedValue({
      width: 1000,
      height: 1000,
      format: 'png',
    });

    await processImage(mockFile);

    expect(mockSharpInstance.png).toHaveBeenCalledWith({
      quality: 85,
      compressionLevel: 9,
    });
    expect(mockSharpInstance.jpeg).not.toHaveBeenCalled();
  });

  it('should use JPEG compression for non-PNG images', async () => {
    const mockFile = createMockFile();

    mockSharpInstance.metadata.mockResolvedValue({
      width: 1000,
      height: 1000,
      format: 'webp',
    });

    await processImage(mockFile);

    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
      quality: 85,
      progressive: true,
    });
    expect(mockSharpInstance.png).not.toHaveBeenCalled();
  });
});
