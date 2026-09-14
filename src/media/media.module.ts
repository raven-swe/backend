import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaService } from './media.service';
import { MediaRepository } from './media.repository';
import { S3Service } from './s3/s3.service';
import { LocalStorageService } from './local';
import { MEDIA_STORAGE } from './storage';
import type { MediaStorage } from './storage';
import { MediaController } from './media.controller';
import { MEDIA_STORAGE_DRIVERS, resolveMediaStorageDriver } from './constants';

export function createMediaStorage(configService: ConfigService): MediaStorage {
  const driver = resolveMediaStorageDriver(configService.get<string>('MEDIA_STORAGE_DRIVER'));

  return driver === MEDIA_STORAGE_DRIVERS.LOCAL
    ? new LocalStorageService(configService)
    : new S3Service(configService);
}

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaRepository,
    { provide: MEDIA_STORAGE, inject: [ConfigService], useFactory: createMediaStorage },
  ],
  exports: [MediaService, MediaRepository],
})
export class MediaModule {}
