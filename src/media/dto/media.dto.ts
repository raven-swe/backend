import { MediaType } from '@prisma/client';

export class MediaDto {
  userId: bigint;

  url: string;

  type: MediaType;

  width: number;

  height: number;

  altText?: string;
}
