import { MediaType } from '@prisma/client';
import { IsNumber, IsString, IsUrl } from 'class-validator';

export class MediaDto {
  userId: bigint;

  @IsUrl()
  url: string;

  type: MediaType;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsString()
  altText?: string;
}
