import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';

const ABSOLUTE_URL_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;
const MEDIA_URL_FIELDS = new Set(['avatarUrl', 'bannerUrl', 'mediaUrl', 'url']);

@Injectable()
export class MediaUrlService {
  private readonly cdnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.cdnUrl = (this.configService.get<string>('CDN_URL') || '').replace(/\/+$/, '');
  }

  isAbsolute(value: string): boolean {
    return ABSOLUTE_URL_REGEX.test(value);
  }

  toAbsolute(value: string): string;
  toAbsolute(value: string | null | undefined): string | null | undefined;
  toAbsolute(value: string | null | undefined): string | null | undefined {
    if (!value || this.isAbsolute(value)) return value;

    return `${this.cdnUrl}/${value.replace(/^\/+/, '')}`;
  }

  toRelative(value: string): string;
  toRelative(value: string | null | undefined): string | null | undefined;
  toRelative(value: string | null | undefined): string | null | undefined {
    if (!value) return value;

    if (!this.isAbsolute(value)) return value.replace(/^\/+/, '');

    if (this.cdnUrl && value.startsWith(`${this.cdnUrl}/`))
      return value.slice(this.cdnUrl.length + 1);

    return value;
  }

  resolve<T>(payload: T): T {
    this.expand(payload);
    return payload;
  }

  private expand(value: unknown): void {
    // Fast fail: nulls, primitives, or Dates
    if (!value || typeof value !== 'object' || value instanceof Date) return;

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) this.expand(value[i]);

      return;
    }

    const record = value as Record<string, unknown>;

    for (const key in record) {
      const child = record[key];

      if (MEDIA_URL_FIELDS.has(key)) {
        if (key === 'avatarUrl' && child === null) {
          record[key] = this.toAbsolute(DEFAULT_PROFILE_PICTURE);
          continue;
        }

        if (typeof child === 'string') {
          record[key] = this.toAbsolute(child);
          continue;
        }
      }

      if (typeof child === 'object' && child !== null) this.expand(child);
    }
  }
}
