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
  @IsUrl(
    {
      require_protocol: true, // must start with http:// or https://
      require_valid_protocol: true,
      protocols: ['http', 'https'],
      require_host: true, // must include host (e.g., example.com)
      allow_protocol_relative_urls: false,
    },
    { message: 'Website URL must be a valid URL (e.g. https://example.com)' },
  )
  websiteUrl?: string | null;

  @IsOptional()
  @IsString()
  @IsUrl(
    {
      require_protocol: true,
      require_valid_protocol: true,
      require_host: true,
      allow_protocol_relative_urls: false,
    },
    { message: 'Website URL must be a valid URL (e.g. https://example.com)' },
  )
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @IsUrl(
    {
      require_protocol: true,
      require_valid_protocol: true,
      require_host: true,
      allow_protocol_relative_urls: false,
    },
    { message: 'Website URL must be a valid URL (e.g. https://example.com)' },
  )
  bannerUrl?: string | null;
}
