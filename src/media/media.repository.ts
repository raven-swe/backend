import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MediaDto } from './dtos';

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
        pending: mediaDto.pending,
      },
    });

    return media;
  }

  async findByUrl(url: string) {
    const media = await this.prisma.media.findFirst({
      where: { url },
    });

    return media;
  }

  async deleteMedia(id: bigint) {
    await this.prisma.media.delete({
      where: { id },
    });
  }

  async findPendingMediaOlderThan(date: Date) {
    const media = await this.prisma.media.findMany({
      where: {
        pending: true,
        createdAt: {
          lt: date,
        },
      },
    });

    return media;
  }

  async markMediaAsNotPending(id: bigint) {
    await this.prisma.media.update({
      where: { id },
      data: { pending: false },
    });
  }
}
