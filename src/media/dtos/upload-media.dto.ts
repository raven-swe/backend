import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MediaFolder } from '../enums';

export class UploadMedia {
  @IsEnum(MediaFolder)
  folder: MediaFolder;

  @IsString()
  @IsOptional()
  altText?: string;
}
