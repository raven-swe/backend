import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsOptionalDate } from '../decorators/is-optional-date.decorator';
import { VALIDATION_ERROR_CODES } from 'src/common/validation-error-codes';

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

  @IsOptionalDate(VALIDATION_ERROR_CODES.NOT_A_DATE)
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
  @IsString()
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  bannerUrl?: string | null;
}
