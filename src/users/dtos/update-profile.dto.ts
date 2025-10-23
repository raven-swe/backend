import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Display name should be at least 1 character' })
  @MaxLength(100, { message: 'Display name should not exceed 100 characters' })
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'Bio should not exceed 160 characters' })
  bio?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Location should not exceed 100 characters' })
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Website URL should not exceed 255 characters' })
  @IsUrl({}, { message: 'Website URL must be a valid URL' })
  websiteUrl?: string | null;
}
