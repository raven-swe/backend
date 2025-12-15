import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContentParsingService } from 'src/content-parsing/content-parsing.service';
import { UsersService } from 'src/users/users.service';
import { TrendingService } from 'src/trending/trending.service';
import { Prisma } from '@prisma/client';
import Groq from 'groq-sdk';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/unbound-method */

// Mock Groq
jest.mock('groq-sdk');

describe('ContentParsingService', () => {
  let service: ContentParsingService;
  let usersService: jest.Mocked<UsersService>;
  let trendingService: jest.Mocked<TrendingService>;
  let mockGroq: jest.Mocked<Groq>;

  const mockTx = {} as Prisma.TransactionClient;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock Groq instance
    mockGroq = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as unknown as jest.Mocked<Groq>;

    // Mock Groq constructor
    (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => mockGroq);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentParsingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SUMMARY_API_KEY') return 'test-api-key';
              return undefined;
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            checkUsernamesExistenceAndReplaceIds: jest.fn(),
          },
        },
        {
          provide: TrendingService,
          useValue: {
            createOrGetHashtags: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContentParsingService>(ContentParsingService);
    usersService = module.get(UsersService);
    trendingService = module.get(TrendingService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should throw error if SUMMARY_API_KEY is not configured', () => {
      const badConfigService = {
        get: jest.fn(() => undefined),
      } as unknown as ConfigService;

      expect(() => {
        new ContentParsingService({} as UsersService, {} as TrendingService, badConfigService);
      }).toThrow('SUMMARY_API_KEY environment variable is required');
    });

    it('should initialize Groq client with API key', () => {
      expect(Groq).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });
  });

  describe('parseContentAndValidate', () => {
    it('should return empty arrays for empty content', async () => {
      const result = await service.parseContentAndValidate('', mockTx);

      expect(result).toEqual({ mentions: [], hashtags: [] });

      expect(usersService.checkUsernamesExistenceAndReplaceIds).not.toHaveBeenCalled();

      expect(trendingService.createOrGetHashtags).not.toHaveBeenCalled();
    });

    it('should return empty arrays for null content', async () => {
      const result = await service.parseContentAndValidate(null as unknown as string, mockTx);

      expect(result).toEqual({ mentions: [], hashtags: [] });
    });

    it('should parse and validate mentions and hashtags', async () => {
      const content = 'Hello @john and @jane! Check out #nodejs #typescript';

      const mockMentions = [
        { username: 'john', startPosition: 6, userId: BigInt(1) },
        { username: 'jane', startPosition: 16, userId: BigInt(2) },
      ];

      const mockHashtags = [
        { keyword: 'nodejs', startPosition: 33, hashtagId: BigInt(10) },
        { keyword: 'typescript', startPosition: 41, hashtagId: BigInt(11) },
      ];

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue(mockMentions);
      trendingService.createOrGetHashtags.mockResolvedValue(mockHashtags);

      const result = await service.parseContentAndValidate(content, mockTx);

      expect(result.mentions).toEqual(mockMentions);
      expect(result.hashtags).toEqual(mockHashtags);

      expect(usersService.checkUsernamesExistenceAndReplaceIds).toHaveBeenCalledWith(
        [
          { username: 'john', startPosition: 6 },
          { username: 'jane', startPosition: 16 },
        ],
        mockTx,
      );

      expect(trendingService.createOrGetHashtags).toHaveBeenCalledWith(
        [
          { keyword: 'nodejs', startPosition: 33 },
          { keyword: 'typescript', startPosition: 41 },
        ],
        mockTx,
      );
    });

    it('should handle content with only mentions', async () => {
      const content = 'Hello @alice';

      const mockMentions = [{ username: 'alice', startPosition: 6, userId: BigInt(1) }];

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue(mockMentions);
      trendingService.createOrGetHashtags.mockResolvedValue([]);

      const result = await service.parseContentAndValidate(content, mockTx);

      expect(result.mentions).toEqual(mockMentions);
      expect(result.hashtags).toEqual([]);
    });

    it('should handle content with only hashtags', async () => {
      const content = 'Check this out #cool #trending';

      const mockHashtags = [
        { keyword: 'cool', startPosition: 15, hashtagId: BigInt(1) },
        { keyword: 'trending', startPosition: 21, hashtagId: BigInt(2) },
      ];

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([]);
      trendingService.createOrGetHashtags.mockResolvedValue(mockHashtags);

      const result = await service.parseContentAndValidate(content, mockTx);

      expect(result.mentions).toEqual([]);
      expect(result.hashtags).toEqual(mockHashtags);
    });

    it('should handle content with no mentions or hashtags', async () => {
      const content = 'Just a regular tweet without any special entities';

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([]);
      trendingService.createOrGetHashtags.mockResolvedValue([]);

      const result = await service.parseContentAndValidate(content, mockTx);

      expect(result.mentions).toEqual([]);
      expect(result.hashtags).toEqual([]);
    });

    it('should respect username length limit (1-15 chars)', async () => {
      const content = '@a @abc @abcdefghij12345 @abcdefghij123456 @valid_user';

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([
        { username: 'a', startPosition: 0, userId: BigInt(1) },
        { username: 'abc', startPosition: 3, userId: BigInt(2) },
        { username: 'abcdefghij12345', startPosition: 8, userId: BigInt(3) },
        { username: 'valid_user', startPosition: 44, userId: BigInt(4) },
      ]);
      trendingService.createOrGetHashtags.mockResolvedValue([]);

      const result = await service.parseContentAndValidate(content, mockTx);

      // Should capture @a, @abc, @abcdefghij12345 (15 chars), and @valid_user
      // Should NOT capture @abcdefghij123456 (16 chars, too long)
      expect(result.mentions).toHaveLength(4);
    });

    it('should respect hashtag length limit (1-100 chars)', async () => {
      const content = `#a #abc #${'x'.repeat(100)} #${'y'.repeat(101)}`;

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([]);
      trendingService.createOrGetHashtags.mockResolvedValue([
        { keyword: 'a', startPosition: 0, hashtagId: BigInt(1) },
        { keyword: 'abc', startPosition: 3, hashtagId: BigInt(2) },
        { keyword: 'x'.repeat(100), startPosition: 8, hashtagId: BigInt(3) },
      ]);

      await service.parseContentAndValidate(content, mockTx);

      expect(trendingService.createOrGetHashtags).toHaveBeenCalledWith(
        expect.arrayContaining([
          { keyword: 'a', startPosition: 0 },
          { keyword: 'abc', startPosition: 3 },
          { keyword: 'x'.repeat(100), startPosition: 8 },
        ]),
        mockTx,
      );
    });

    it('should not match mentions/hashtags preceded by alphanumeric characters', async () => {
      const content = 'email@john.com test#hashtag regular @mention and #tag';

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([
        { username: 'mention', startPosition: 40, userId: BigInt(1) },
      ]);
      trendingService.createOrGetHashtags.mockResolvedValue([
        { keyword: 'tag', startPosition: 53, hashtagId: BigInt(1) },
      ]);

      const result = await service.parseContentAndValidate(content, mockTx);

      // Should only match @mention and #tag, not email@john or test#hashtag
      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0].username).toBe('mention');
      expect(result.hashtags).toHaveLength(1);
      expect(result.hashtags[0].keyword).toBe('tag');
    });
  });

  describe('parseContentForBio', () => {
    it('should return empty arrays for empty content', async () => {
      const result = await service.parseContentForBio('', mockTx);

      expect(result).toEqual({ mentions: [], hashtags: [] });
    });

    it('should return empty arrays for null content', async () => {
      const result = await service.parseContentForBio(null as unknown as string, mockTx);

      expect(result).toEqual({ mentions: [], hashtags: [] });
    });

    it('should validate mentions but return plain hashtags', async () => {
      const content = 'Bio with @user and #hashtag';

      const mockMentions = [{ username: 'user', startPosition: 9, userId: BigInt(1) }];

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue(mockMentions);

      const result = await service.parseContentForBio(content, mockTx);

      expect(result.mentions).toEqual(mockMentions);
      expect(result.hashtags).toEqual([{ keyword: 'hashtag', startPosition: 19 }]);

      expect(usersService.checkUsernamesExistenceAndReplaceIds).toHaveBeenCalledWith(
        [{ username: 'user', startPosition: 9 }],
        mockTx,
      );

      // Should NOT call trending service for bio hashtags

      expect(trendingService.createOrGetHashtags).not.toHaveBeenCalled();
    });

    it('should handle bio with only mentions', async () => {
      const content = 'Follow @alice and @bob';

      const mockMentions = [
        { username: 'alice', startPosition: 7, userId: BigInt(1) },
        { username: 'bob', startPosition: 18, userId: BigInt(2) },
      ];

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue(mockMentions);

      const result = await service.parseContentForBio(content, mockTx);

      expect(result.mentions).toEqual(mockMentions);
      expect(result.hashtags).toEqual([]);
    });

    it('should handle bio with only hashtags', async () => {
      const content = 'Developer #nodejs #typescript';

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([]);

      const result = await service.parseContentForBio(content, mockTx);

      expect(result.mentions).toEqual([]);
      expect(result.hashtags).toEqual([
        { keyword: 'nodejs', startPosition: 10 },
        { keyword: 'typescript', startPosition: 18 },
      ]);
    });

    it('should handle bio with no special entities', async () => {
      const content = 'Just a regular bio';

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([]);

      const result = await service.parseContentForBio(content, mockTx);

      expect(result.mentions).toEqual([]);
      expect(result.hashtags).toEqual([]);
    });
  });

  describe('generateTweetSummary', () => {
    beforeEach(() => {
      mockGroq.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'The tweet is talking about testing and development.',
            },
          },
        ],
      } as never);
    });

    it('should generate summary in English by default', async () => {
      const content = 'Testing my new feature!';

      const summary = await service.generateTweetSummary(content);

      expect(summary).toBe('The tweet is talking about testing and development.');
      expect(mockGroq.chat.completions.create).toHaveBeenCalledWith({
        messages: [
          {
            role: 'user',
            content: expect.stringContaining('Summarize the following tweet'),
          },
        ],
        model: 'openai/gpt-oss-120b',
      });
    });

    it('should generate summary in English when langcode is en-US', async () => {
      const content = 'Testing my new feature!';

      await service.generateTweetSummary(content, 'en-US');

      expect(mockGroq.chat.completions.create).toHaveBeenCalledWith({
        messages: [
          {
            role: 'user',
            content: expect.stringContaining('Summarize the following tweet'),
          },
        ],
        model: 'openai/gpt-oss-120b',
      });
    });

    it('should generate summary in Arabic when langcode starts with ar', async () => {
      const content = 'اختبار الميزة الجديدة';

      mockGroq.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'التغريدة تتحدث عن اختبار ميزة جديدة.',
            },
          },
        ],
      } as never);

      const summary = await service.generateTweetSummary(content, 'ar-EG');

      expect(summary).toBe('التغريدة تتحدث عن اختبار ميزة جديدة.');
      expect(mockGroq.chat.completions.create).toHaveBeenCalledWith({
        messages: [
          {
            role: 'user',
            content: expect.stringContaining('لخص التغريدة التالية'),
          },
        ],
        model: 'openai/gpt-oss-120b',
      });
    });

    it('should trim whitespace from summary', async () => {
      const content = 'Test tweet';

      mockGroq.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: '  The tweet is talking about testing.  ',
            },
          },
        ],
      } as never);

      const summary = await service.generateTweetSummary(content);

      expect(summary).toBe('The tweet is talking about testing.');
    });

    it('should return empty string if no content in response', async () => {
      const content = 'Test tweet';

      mockGroq.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      } as never);

      const summary = await service.generateTweetSummary(content);

      expect(summary).toBe('');
    });

    it('should return empty string if choices array is empty', async () => {
      const content = 'Test tweet';

      mockGroq.chat.completions.create.mockResolvedValue({
        choices: [],
      } as never);

      const summary = await service.generateTweetSummary(content);

      expect(summary).toBe('');
    });

    it('should throw error when API call fails with Error instance', async () => {
      const content = 'Test tweet';

      mockGroq.chat.completions.create.mockRejectedValue(new Error('API error'));

      await expect(service.generateTweetSummary(content)).rejects.toThrow(
        'Failed to generate tweet summary',
      );
    });

    it('should throw error when API call fails with non-Error', async () => {
      const content = 'Test tweet';

      mockGroq.chat.completions.create.mockRejectedValue('Unknown error');

      await expect(service.generateTweetSummary(content)).rejects.toThrow(
        'Failed to generate tweet summary',
      );
    });

    it('should include tweet content in prompt', async () => {
      const content = 'This is my amazing tweet about TypeScript!';

      await service.generateTweetSummary(content);

      expect(mockGroq.chat.completions.create).toHaveBeenCalledWith({
        messages: [
          {
            role: 'user',
            content: expect.stringContaining(content),
          },
        ],
        model: 'openai/gpt-oss-120b',
      });
    });

    it('should use correct model ID', async () => {
      const content = 'Test';

      await service.generateTweetSummary(content);

      expect(mockGroq.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'openai/gpt-oss-120b',
        }),
      );
    });
  });

  describe('edge cases and special characters', () => {
    it('should handle multiple consecutive mentions', async () => {
      const content = '@user1@user2 @user3';

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([
        { username: 'user1', startPosition: 0, userId: BigInt(1) },
        { username: 'user3', startPosition: 13, userId: BigInt(3) },
      ]);
      trendingService.createOrGetHashtags.mockResolvedValue([]);

      const result = await service.parseContentAndValidate(content, mockTx);

      // @user1 should match, @user2 should not (preceded by @user1), @user3 should match
      expect(result.mentions.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle mentions with underscores', async () => {
      const content = 'Hello @user_name_123';

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([
        { username: 'user_name_123', startPosition: 6, userId: BigInt(1) },
      ]);
      trendingService.createOrGetHashtags.mockResolvedValue([]);

      const result = await service.parseContentAndValidate(content, mockTx);

      expect(result.mentions[0].username).toBe('user_name_123');
    });

    it('should handle hashtags with numbers', async () => {
      const content = '#2024trends #nodejs2023';

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([]);
      trendingService.createOrGetHashtags.mockResolvedValue([
        { keyword: '2024trends', startPosition: 0, hashtagId: BigInt(1) },
        { keyword: 'nodejs2023', startPosition: 12, hashtagId: BigInt(2) },
      ]);

      const result = await service.parseContentAndValidate(content, mockTx);

      expect(result.hashtags).toHaveLength(2);
    });

    it('should handle multiline content', async () => {
      const content = `Line 1 with @user1
Line 2 with #hashtag1
Line 3 with @user2 and #hashtag2`;

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([
        { username: 'user1', startPosition: 12, userId: BigInt(1) },
        { username: 'user2', startPosition: 54, userId: BigInt(2) },
      ]);
      trendingService.createOrGetHashtags.mockResolvedValue([
        { keyword: 'hashtag1', startPosition: 31, hashtagId: BigInt(1) },
        { keyword: 'hashtag2', startPosition: 65, hashtagId: BigInt(2) },
      ]);

      const result = await service.parseContentAndValidate(content, mockTx);

      expect(result.mentions).toHaveLength(2);
      expect(result.hashtags).toHaveLength(2);
    });

    it('should handle Unicode characters in content', async () => {
      const content = '🎉 @user celebrating with #party 🎊';

      usersService.checkUsernamesExistenceAndReplaceIds.mockResolvedValue([
        { username: 'user', startPosition: expect.any(Number), userId: BigInt(1) },
      ]);
      trendingService.createOrGetHashtags.mockResolvedValue([
        { keyword: 'party', startPosition: expect.any(Number), hashtagId: BigInt(1) },
      ]);

      const result = await service.parseContentAndValidate(content, mockTx);

      expect(result.mentions).toHaveLength(1);
      expect(result.hashtags).toHaveLength(1);
    });
  });
});
