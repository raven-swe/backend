import { MediaType } from '@prisma/client';

export class MediaResponseDto {
  type: MediaType;
  url: string;
  altText: string | null;
  width: number;
  height: number;
}
