import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaRepository } from './media.repository';
import { MediaController } from './media.controller';
import { S3Service } from './s3/s3.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaRepository, S3Service],
  exports: [MediaService, MediaRepository],
})
export class MediaModule {}
