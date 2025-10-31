import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsMinYearsOld } from 'src/auth/dto/start-registration.dto';

export class UpdateProfileDto {
  @Transform(({ value }: { value: string | null }) => (value === null ? '' : value?.trim()))
  @IsOptional()
  @IsNotEmpty()
  @IsString()
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
  @Transform(({ value }: { value: string | null }) => (value === null ? '' : value))
  @IsNotEmpty({ message: 'birthDate must not be empty if provided' })
  @IsMinYearsOld(13, { message: 'You must be at least 13 years old' })
  @IsDate()
  birthDate?: Date;

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
  @IsBoolean()
  deleteBanner?: boolean;
}
