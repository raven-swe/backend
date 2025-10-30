import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MediaDto } from './dto/media.dto';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveMedia(mediaDto: MediaDto) {
    const media = await this.prisma.media.create({
      data: {
        user_id: mediaDto.userId,
        url: mediaDto.url,
        type: mediaDto.type,
        width: mediaDto.width,
        height: mediaDto.height,
        alt_text: mediaDto.altText,
        // TODO: delete this when removing tweet_id from media table
        tweet_id: BigInt(1),
      },
    });

    return {
      userId: media.user_id,
      
    }
  }
}
