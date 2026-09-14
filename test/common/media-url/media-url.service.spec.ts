import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediaUrlService } from 'src/common/media-url';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';

const CDN_URL = 'https://cdn.example.com';

const createService = async (cdnUrl: string | null = CDN_URL): Promise<MediaUrlService> => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MediaUrlService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => (key === 'CDN_URL' ? (cdnUrl ?? undefined) : undefined) },
      },
    ],
  }).compile();

  return module.get<MediaUrlService>(MediaUrlService);
};

describe('MediaUrlService', () => {
  let service: MediaUrlService;

  beforeEach(async () => {
    service = await createService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isAbsolute', () => {
    it.each([
      'https://cdn.example.com/avatars/file.jpg',
      'http://example.com/avatars/file.jpg',
      'HTTPS://EXAMPLE.COM/file.jpg',
      's3://bucket/file.jpg',
    ])('should treat %s as absolute', (value) => {
      expect(service.isAbsolute(value)).toBe(true);
    });

    it.each(['avatars/file.jpg', '/avatars/file.jpg', 'default_avatar.png', ''])(
      'should treat %s as relative',
      (value) => {
        expect(service.isAbsolute(value)).toBe(false);
      },
    );
  });

  describe('toAbsolute', () => {
    it('should prefix a relative key with the CDN origin', () => {
      expect(service.toAbsolute('avatars/file.jpg')).toBe(`${CDN_URL}/avatars/file.jpg`);
    });

    it('should not double the separator for keys with a leading slash', () => {
      expect(service.toAbsolute('/avatars/file.jpg')).toBe(`${CDN_URL}/avatars/file.jpg`);
    });

    it('should leave an absolute url untouched', () => {
      expect(service.toAbsolute('https://media.tenor.com/test.gif')).toBe(
        'https://media.tenor.com/test.gif',
      );
    });

    it('should be idempotent', () => {
      const once = service.toAbsolute('avatars/file.jpg');

      expect(service.toAbsolute(once)).toBe(once);
    });

    it.each([null, undefined, ''])('should pass %s through unchanged', (value) => {
      expect(service.toAbsolute(value)).toBe(value);
    });

    it('should trim a trailing slash off the configured CDN origin', async () => {
      const withTrailingSlash = await createService(`${CDN_URL}/`);

      expect(withTrailingSlash.toAbsolute('avatars/file.jpg')).toBe(`${CDN_URL}/avatars/file.jpg`);
    });
  });

  describe('toRelative', () => {
    it('should strip the CDN origin', () => {
      expect(service.toRelative(`${CDN_URL}/avatars/file.jpg`)).toBe('avatars/file.jpg');
    });

    it('should strip a leading slash from a relative path', () => {
      expect(service.toRelative('/avatars/file.jpg')).toBe('avatars/file.jpg');
    });

    it('should leave a key that is already relative untouched', () => {
      expect(service.toRelative('avatars/file.jpg')).toBe('avatars/file.jpg');
    });

    it('should leave urls hosted elsewhere untouched', () => {
      expect(service.toRelative('https://media.tenor.com/test.gif')).toBe(
        'https://media.tenor.com/test.gif',
      );
    });

    it.each([null, undefined, ''])('should pass %s through unchanged', (value) => {
      expect(service.toRelative(value)).toBe(value);
    });
  });

  describe('resolve', () => {
    it('should expand every known media field in place', () => {
      const payload = {
        avatarUrl: 'avatars/a.jpg',
        bannerUrl: 'banners/b.jpg',
        mediaUrl: 'messages/c.mp4',
        url: 'tweets/d.png',
      };

      const result = service.resolve(payload);

      expect(result).toBe(payload);
      expect(payload).toEqual({
        avatarUrl: `${CDN_URL}/avatars/a.jpg`,
        bannerUrl: `${CDN_URL}/banners/b.jpg`,
        mediaUrl: `${CDN_URL}/messages/c.mp4`,
        url: `${CDN_URL}/tweets/d.png`,
      });
    });

    it('should expand nested objects and arrays', () => {
      const payload = {
        data: {
          tweets: [
            { author: { avatarUrl: 'avatars/a.jpg' }, media: [{ url: 'tweets/d.png' }] },
            { author: { avatarUrl: 'avatars/b.jpg' }, media: [] },
          ],
        },
      };

      service.resolve(payload);

      expect(payload.data.tweets[0].author.avatarUrl).toBe(`${CDN_URL}/avatars/a.jpg`);
      expect(payload.data.tweets[0].media[0].url).toBe(`${CDN_URL}/tweets/d.png`);
      expect(payload.data.tweets[1].author.avatarUrl).toBe(`${CDN_URL}/avatars/b.jpg`);
    });

    it('should substitute the default picture for a null avatarUrl', () => {
      const payload = { avatarUrl: null };

      service.resolve(payload);

      expect(payload.avatarUrl).toBe(`${CDN_URL}/${DEFAULT_PROFILE_PICTURE}`);
    });

    it('should leave a null bannerUrl or mediaUrl alone', () => {
      const payload = { bannerUrl: null, mediaUrl: null, url: null };

      service.resolve(payload);

      expect(payload).toEqual({ bannerUrl: null, mediaUrl: null, url: null });
    });

    it('should leave absolute urls untouched', () => {
      const payload = { url: 'https://media.tenor.com/test.gif' };

      service.resolve(payload);

      expect(payload.url).toBe('https://media.tenor.com/test.gif');
    });

    it('should not touch fields that are not media urls', () => {
      const payload = { username: 'layla', redirectUrl: '/home', count: 3 };

      service.resolve(payload);

      expect(payload).toEqual({ username: 'layla', redirectUrl: '/home', count: 3 });
    });

    it('should not recurse into Date values', () => {
      const createdAt = new Date('2024-01-01T10:00:00Z');
      const payload = { createdAt };

      service.resolve(payload);

      expect(payload.createdAt).toBe(createdAt);
      expect(payload.createdAt.toISOString()).toBe('2024-01-01T10:00:00.000Z');
    });

    it.each([null, undefined, 'a string', 42])('should pass %s through unchanged', (value) => {
      expect(service.resolve(value)).toBe(value);
    });

    it('should expand a top level array', () => {
      const payload = [{ avatarUrl: 'avatars/a.jpg' }, { avatarUrl: 'avatars/b.jpg' }];

      service.resolve(payload);

      expect(payload).toEqual([
        { avatarUrl: `${CDN_URL}/avatars/a.jpg` },
        { avatarUrl: `${CDN_URL}/avatars/b.jpg` },
      ]);
    });
  });

  describe('when CDN_URL is not configured', () => {
    it('should fall back to a root relative path', async () => {
      const unconfigured = await createService(null);

      expect(unconfigured.toAbsolute('avatars/file.jpg')).toBe('/avatars/file.jpg');
    });

    it('should still strip a leading slash in toRelative', async () => {
      const unconfigured = await createService(null);

      expect(unconfigured.toRelative('/avatars/file.jpg')).toBe('avatars/file.jpg');
    });
  });
});
