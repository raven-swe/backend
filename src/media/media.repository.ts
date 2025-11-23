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

  async checkMediaExists(mediaIds: bigint[]): Promise<boolean> {
    const count = await this.prisma.media.count({
      where: {
        id: { in: mediaIds },
      },
    });
    return count === mediaIds.length;
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

  async markMediaAsNotPending(mediaIds: bigint[]) {
    await this.prisma.media.updateMany({
      where: { id: { in: mediaIds } },
      data: { pending: false },
    });
  }

  /**
   * Finds media URLs by their IDs, preserving the order of the input array.
   * @param mediaIds An array of media IDs.
   * @returns Array of URLs in the same order as the input IDs.
   */
  async findOrderedUrlsByIds(mediaIds: bigint[]): Promise<string[]> {
    if (mediaIds.length === 0) {
      return [];
    }

    const mediaItems = await this.prisma.media.findMany({
      where: {
        id: { in: mediaIds },
      },
      select: {
        id: true,
        url: true,
      },
    });

    const urlMap = new Map<bigint, string>(mediaItems.map((item) => [item.id, item.url]));

    // Map over the original mediaIds array to ensure the order is preserved.
    return mediaIds.map((id) => urlMap.get(id)).filter((url): url is string => url !== undefined);
  }
}
