import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { LocalStorageService } from 'src/media/local';
import { MediaStorageError } from 'src/media/storage';

jest.mock('crypto', () => ({
  ...jest.requireActual<typeof import('crypto')>('crypto'),
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
}));

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

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  let mediaRoot: string;

  beforeEach(async () => {
    mediaRoot = await mkdtemp(join(tmpdir(), 'raven-media-'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStorageService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'MEDIA_ROOT' ? mediaRoot : undefined) },
        },
      ],
    }).compile();

    service = module.get<LocalStorageService>(LocalStorageService);
  });

  afterEach(async () => {
    await rm(mediaRoot, { recursive: true, force: true });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should write the file and return the same key shape as the s3 driver', async () => {
      const result = await service.uploadFile({ file: createMockFile(), folder: 'avatars' });

      expect(result).toEqual({ key: 'avatars/mock-uuid-1234.jpg' });
      await expect(readFile(join(mediaRoot, 'avatars/mock-uuid-1234.jpg'), 'utf8')).resolves.toBe(
        'file content',
      );
    });

    it('should create the folder when it does not exist', async () => {
      await service.uploadFile({ file: createMockFile(), folder: 'tweets' });

      await expect(readdir(join(mediaRoot, 'tweets'))).resolves.toEqual(['mock-uuid-1234.jpg']);
    });

    it('should honour a custom filename', async () => {
      const result = await service.uploadFile({
        file: createMockFile(),
        folder: 'banners',
        fileName: 'custom-banner',
      });

      expect(result).toEqual({ key: 'banners/custom-banner.jpg' });
    });

    it('should leave no temp files behind on success', async () => {
      await service.uploadFile({ file: createMockFile(), folder: 'avatars' });

      const entries = await readdir(join(mediaRoot, 'avatars'));

      expect(entries.filter((entry) => entry.endsWith('.tmp'))).toEqual([]);
    });

    it('should overwrite an existing key, matching object storage semantics', async () => {
      await service.uploadFile({ file: createMockFile(), folder: 'avatars' });
      await service.uploadFile({
        file: createMockFile({ buffer: Buffer.from('replacement') }),
        folder: 'avatars',
      });

      await expect(readFile(join(mediaRoot, 'avatars/mock-uuid-1234.jpg'), 'utf8')).resolves.toBe(
        'replacement',
      );
    });

    it('should wrap a write failure in MediaStorageError and clean up the temp file', async () => {
      // A directory where the file should go makes rename fail.
      await mkdir(join(mediaRoot, 'avatars/mock-uuid-1234.jpg'), { recursive: true });

      await expect(
        service.uploadFile({ file: createMockFile(), folder: 'avatars' }),
      ).rejects.toThrow(MediaStorageError);

      const entries = await readdir(join(mediaRoot, 'avatars'));

      expect(entries.filter((entry) => entry.endsWith('.tmp'))).toEqual([]);
    });
  });

  describe('deleteFile', () => {
    it('should remove the file', async () => {
      const { key } = await service.uploadFile({ file: createMockFile(), folder: 'avatars' });

      await service.deleteFile(key);

      await expect(service.fileExists(key)).resolves.toBe(false);
    });

    it('should be a no-op when the file is already gone', async () => {
      await expect(service.deleteFile('avatars/missing.jpg')).resolves.toBeUndefined();
    });
  });

  describe('fileExists', () => {
    it('should return true for a stored file', async () => {
      const { key } = await service.uploadFile({ file: createMockFile(), folder: 'avatars' });

      await expect(service.fileExists(key)).resolves.toBe(true);
    });

    it('should return false for a missing file', async () => {
      await expect(service.fileExists('avatars/missing.jpg')).resolves.toBe(false);
    });
  });

  describe('path traversal', () => {
    it.each(['../escaped.jpg', 'avatars/../../escaped.jpg', 'avatars/../../../etc/passwd'])(
      'should refuse to delete through %s',
      async (key) => {
        await expect(service.deleteFile(key)).rejects.toThrow(MediaStorageError);
      },
    );

    it('should refuse to stat outside the root', async () => {
      await expect(service.fileExists('../escaped.jpg')).rejects.toThrow(MediaStorageError);
    });

    it('should not touch a file that sits outside the root', async () => {
      const outside = join(mediaRoot, '..', 'outside-target.jpg');
      await writeFile(outside, 'untouched');

      try {
        await expect(service.deleteFile('../outside-target.jpg')).rejects.toThrow(
          MediaStorageError,
        );
        await expect(readFile(outside, 'utf8')).resolves.toBe('untouched');
      } finally {
        await rm(outside, { force: true });
      }
    });
  });
});
