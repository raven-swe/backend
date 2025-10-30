import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MediaDto } from './dto/media.dto';
import { MediaType } from './enum/media-type.enum';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveMedia(mediaDto: MediaDto) {
    return this.prisma.media.create({
      data: {
        user_id: mediaDto.userId,
        url: mediaDto.url,
        type: mediaDto.type,
        width: mediaDto.width,
        height: mediaDto.height,
        alt_text: mediaDto.altText,
      },
    });
  }
}
