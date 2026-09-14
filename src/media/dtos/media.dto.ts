import { MediaType } from '@prisma/client';
import { IsBoolean, IsNumber, IsString } from 'class-validator';

export class MediaDto {
  userId: bigint;

  @IsString()
  url: string;

  type: MediaType;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsString()
  altText?: string;

  @IsBoolean()
  pending: boolean;
}
