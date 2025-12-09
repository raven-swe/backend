import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MediaFolder } from '../enums';

export class UploadMedia {
  @IsEnum(MediaFolder)
  folder: MediaFolder;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  altText?: string;
}
