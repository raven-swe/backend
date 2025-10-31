import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MediaDto } from './dtos/media.dto';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveMedia(mediaDto: MediaDto) {
    const media = await this.prisma.media.create({
      data: {
        userId: mediaDto.userId,
        url: mediaDto.url,
        type: mediaDto.type,
        width: mediaDto.width,
        height: mediaDto.height,
        altText: mediaDto.altText,
      },
    });

    return media;
  }
}
