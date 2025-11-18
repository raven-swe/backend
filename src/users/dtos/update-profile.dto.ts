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
import { IsMinYearsOld } from 'src/auth/validators/is-min-years-old';

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
  @Transform(({ value }: { value: string | null | Date }) => {
    if (!value || value === null) return undefined;
    if (value instanceof Date) return value;

    // Parse date string and treat it as UTC to avoid timezone shifts
    const dateStr = String(value).trim();

    // Create date in UTC to avoid timezone conversion
    const dateMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      const date = new Date(
        Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), 0, 0, 0, 0),
      );

      return isNaN(date.getTime()) ? value : date;
    }

    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date;
  })
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

  @IsOptional()
  @IsBoolean()
  deleteAvatar?: boolean;
}
