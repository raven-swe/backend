import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { createMediaStorage } from 'src/media/media.module';
import { LocalStorageService } from 'src/media/local';
import { S3Service } from 'src/media/s3/s3.service';
import { MEDIA_STORAGE_DRIVERS, resolveMediaStorageDriver } from 'src/media/constants';

const S3_ENV: Record<string, string> = {
  SPACES_BUCKET: 'test-bucket',
  SPACES_REGION: 'nyc3',
  SPACES_ENDPOINT: 'https://nyc3.digitaloceanspaces.com',
  SPACES_KEY: 'test-access-key',
  SPACES_SECRET: 'test-secret-key',
};

const configWith = (env: Record<string, string>): ConfigService =>
  ({ get: (key: string) => env[key] }) as ConfigService;

describe('media storage driver selection', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveMediaStorageDriver', () => {
    it('should default to s3 so existing deployments are unaffected', () => {
      expect(resolveMediaStorageDriver(undefined)).toBe(MEDIA_STORAGE_DRIVERS.S3);
      expect(resolveMediaStorageDriver(null)).toBe(MEDIA_STORAGE_DRIVERS.S3);
      expect(resolveMediaStorageDriver('')).toBe(MEDIA_STORAGE_DRIVERS.S3);
    });

    it.each(['local', 'LOCAL', '  Local  '])('should read %s as the local driver', (value) => {
      expect(resolveMediaStorageDriver(value)).toBe(MEDIA_STORAGE_DRIVERS.LOCAL);
    });

    it.each(['s3', 'S3', ' s3 '])('should read %s as the s3 driver', (value) => {
      expect(resolveMediaStorageDriver(value)).toBe(MEDIA_STORAGE_DRIVERS.S3);
    });

    it('should warn and fall back to s3 for an unknown value', () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      expect(resolveMediaStorageDriver('gcs')).toBe(MEDIA_STORAGE_DRIVERS.S3);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('gcs'));
    });
  });

  describe('createMediaStorage', () => {
    it('should build the local driver when configured', () => {
      const storage = createMediaStorage(
        configWith({ MEDIA_STORAGE_DRIVER: 'local', MEDIA_ROOT: './storage/media' }),
      );

      expect(storage).toBeInstanceOf(LocalStorageService);
    });

    it('should not require Spaces credentials for the local driver', () => {
      // The whole point of the lazy factory: S3Service throws from its
      // constructor without credentials, which would break a local-only boot.
      expect(() => createMediaStorage(configWith({ MEDIA_STORAGE_DRIVER: 'local' }))).not.toThrow();
    });

    it('should build the s3 driver when configured', () => {
      const storage = createMediaStorage(configWith({ ...S3_ENV, MEDIA_STORAGE_DRIVER: 's3' }));

      expect(storage).toBeInstanceOf(S3Service);
    });

    it('should build the s3 driver when nothing is configured', () => {
      expect(createMediaStorage(configWith(S3_ENV))).toBeInstanceOf(S3Service);
    });
  });
});
