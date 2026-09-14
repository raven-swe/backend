import { Logger } from '@nestjs/common';

export const MEDIA_STORAGE_DRIVERS = {
  S3: 's3',
  LOCAL: 'local',
} as const;

export type MediaStorageDriver = (typeof MEDIA_STORAGE_DRIVERS)[keyof typeof MEDIA_STORAGE_DRIVERS];

export function resolveMediaStorageDriver(value?: string | null): MediaStorageDriver {
  const normalised = value?.trim().toLowerCase();

  if (!normalised) return MEDIA_STORAGE_DRIVERS.S3;

  if (normalised === MEDIA_STORAGE_DRIVERS.LOCAL) return MEDIA_STORAGE_DRIVERS.LOCAL;
  if (normalised === MEDIA_STORAGE_DRIVERS.S3) return MEDIA_STORAGE_DRIVERS.S3;

  new Logger('MediaStorage').warn(
    `Unknown MEDIA_STORAGE_DRIVER "${value}", falling back to "${MEDIA_STORAGE_DRIVERS.S3}". Valid values: ${Object.values(MEDIA_STORAGE_DRIVERS).join(', ')}.`,
  );

  return MEDIA_STORAGE_DRIVERS.S3;
}

export const MEDIA_STATIC_PREFIX = '/media';
