import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { TweetsService } from 'src/tweets/tweets.service';
import { TweetsRepository } from 'src/tweets/tweets.repository';
import { UsersRepository } from 'src/users/users.repository';
import { TWEETS_ERROR_CODES, TWEETS_ERROR_MESSAGES } from 'src/tweets/constants';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/users/constants';
import { PAGINATION_ERROR_CODES, PAGINATION_ERROR_MESSAGES } from 'src/common/constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContentParsingService } from 'src/content-parsing/content-parsing.service';
import { MediaRepository } from 'src/media/media.repository';
import { CreateTweetDto } from 'src/tweets/dtos';
import { DomainEventsService } from 'src/events/domain-events.service';

import { MediaType } from '@prisma/client';
import { getQueueToken } from '@nestjs/bullmq';
import { PeopleSearchFilter } from 'src/search/dtos';
import { RedisService } from 'src/redis/redis.service';
import { TrendingService } from 'src/trending/trending.service';

const encodeCompositeCursor = (cursorObject: object): string => {
  const jsonString = JSON.stringify(cursorObject);
  return Buffer.from(jsonString).toString('base64');
};

type TransactionCallback<T> = (
  tx: Omit<
    PrismaService,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
) => Promise<T>;

describe('TweetsService', () => {
  let service: TweetsService;

  const mockTweetsRepository = {
    findTweetById: jest.fn(),
    hasUserLikedTweet: jest.fn(),
    likeTweet: jest.fn(),
    unlikeTweet: jest.fn(),
    hasUserRetweetedTweet: jest.fn(),
    retweetTweet: jest.fn(),
    unretweetTweet: jest.fn(),
    getTimelineForUser: jest.fn(),
    getFeedSkeletonSQL: jest.fn(),
    hydrateTweetsInList: jest.fn(),
    mapToDetailedTweetDto: jest.fn(),
    getDetailedTweetById: jest.fn(),
    getTweetLikers: jest.fn(),
    getTweetRetweeters: jest.fn(),
    getTweetReplies: jest.fn(),
    getTweetQuotes: jest.fn(),
    create: jest.fn(),
    linkTweetMedia: jest.fn(),
    checkExistingTweet: jest.fn(),
    getReferencedTweet: jest.fn(),
    updateTweetRetweetCount: jest.fn(),
    getUserLikedTweets: jest.fn(),
    getMediaTweetsForUser: jest.fn(),
    validateReferences: jest.fn(),
    getTweetsByQuery: jest.fn(),
    getLatestTweetsByQuery: jest.fn(),
    getRankedTweetsByQuery: jest.fn(),
    getParentTweets: jest.fn(),
    getTweetOrDeleted: jest.fn(),
  };

  const mockUsersRepository = {
    areUsersBlocked: jest.fn(),
    findByUsername: jest.fn(),
    findByUsernameWithDisplayname: jest.fn(),
    findOwnTweetAuthorMetaData: jest.fn(),
  };

  const mockContentParsingService = {
    parseContentAndValidate: jest.fn(),
  };

  const mockMediaRepository = {
    markMediaAsNotPending: jest.fn(),
    findOrderedMediaObjectsByIds: jest.fn(),
  };

  const mockPrismaService = {
    $transaction: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    getex: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  const mockDomainEventsService = {
    publish: jest.fn(),
    emitTweetCreated: jest.fn(),
    emitTweetLiked: jest.fn(),
    emitTweetRetweeted: jest.fn(),
  };
  const mockTrendingService = {
    getHashtagId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TweetsService,
        {
          provide: TweetsRepository,
          useValue: mockTweetsRepository,
        },
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ContentParsingService,
          useValue: mockContentParsingService,
        },
        {
          provide: MediaRepository,
          useValue: mockMediaRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: TrendingService,
          useValue: mockTrendingService,
        },
        {
          provide: getQueueToken('timeline-following'),
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn(),
            del: jest.fn(),
            safeIncr: jest.fn(),
            safeDecr: jest.fn(),
          },
        },
        {
          provide: DomainEventsService,
          useValue: mockDomainEventsService,
        },
      ],
    }).compile();

    mockPrismaService.$transaction.mockImplementation(
      async <T>(callback: TransactionCallback<T>): Promise<T> => {
        return callback(mockPrismaService as never);
      },
    );

    service = module.get<TweetsService>(TweetsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTweet', () => {
    const userId = BigInt(1);
    const mockTweet = {
      id: BigInt(100),
      userId,
      content: 'Hello world!',
      hasMedia: false,
      hasHashtags: false,
      hasMentions: false,
      replyToTweetId: null,
      quotedTweetId: null,
      rootTweetId: null,
      likeCount: 0,
      retweetCount: 0,
      replyCount: 0,
      isDeleted: false,
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
      updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    };

    const mockMentions = [{ userId: BigInt(2), username: 'testuser', startPosition: 6 }];
    const mockHashtags = [{ hashtagId: BigInt(1), keyword: 'test', startPosition: 15 }];

    beforeEach(() => {
      mockContentParsingService.parseContentAndValidate.mockReset();
      mockTweetsRepository.create.mockReset();
      mockTweetsRepository.linkTweetMedia.mockReset();
      mockTweetsRepository.checkExistingTweet.mockReset();
      mockPrismaService.$transaction.mockClear();
      mockTweetsRepository.validateReferences.mockReset();
    });

    it('should successfully create a basic tweet', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'Hello world!',
      };

      const mockAuthorDto = {
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      mockContentParsingService.parseContentAndValidate.mockResolvedValue({
        mentions: mockMentions,
        hashtags: mockHashtags,
      });
      mockTweetsRepository.create.mockResolvedValue(mockTweet);
      mockTweetsRepository.linkTweetMedia.mockResolvedValue(undefined);
      mockTweetsRepository.validateReferences.mockResolvedValue({ tweetCount: 0, mediaCount: 0 });
      mockMediaRepository.findOrderedMediaObjectsByIds.mockResolvedValue([]);
      mockUsersRepository.findOwnTweetAuthorMetaData.mockResolvedValue(mockAuthorDto);

      // Act
      const result = await service.createTweet(createTweetDto, userId);

      // Assert
      expect(result).toEqual({
        id: '100',
        author: mockAuthorDto,
        content: 'Hello world!',
        createdAt: mockTweet.createdAt,
        replyCount: 0,
        retweetCount: 0,
        likeCount: 0,
        isLiked: false,
        isRetweeted: false,
        entities: {
          mentions: [{ username: 'testuser', startPosition: 6 }],
          hashtags: [{ hashtag: 'test', startPosition: 15 }], // Note: 'hashtag' not 'keyword'
        },
        media: [],
        replyToTweetId: null,
        quoteToTweetId: null,
        quotedTweet: undefined,
        replyToTweet: undefined,
        rootTweetId: null,
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockContentParsingService.parseContentAndValidate).toHaveBeenCalledWith(
        'Hello world!',
        mockPrismaService,
      );
      expect(mockTweetsRepository.create).toHaveBeenCalledWith(
        {
          userId,
          content: 'Hello world!',
          replyToTweetId: null,
          quotedTweetId: null,
          rootTweetId: null,
          Mentions: [
            {
              userId: BigInt(2),
              startPosition: 6,
            },
          ],
          Hashtags: [
            {
              hashtagId: BigInt(1),
              startPosition: 15,
            },
          ],
          hasMedia: false,
        },
        mockPrismaService,
      );
      expect(mockTweetsRepository.linkTweetMedia).toHaveBeenCalledWith(
        BigInt(100),
        [],
        mockPrismaService,
      );
    });

    // Add these test cases to your existing createTweet describe block

    it('should successfully create a tweet with media', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'Hello world with media!',
        media: ['1', '2'],
      };

      const mockAuthorDto = {
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      mockContentParsingService.parseContentAndValidate.mockResolvedValue({
        mentions: mockMentions,
        hashtags: mockHashtags,
      });
      mockTweetsRepository.create.mockResolvedValue(mockTweet);
      mockTweetsRepository.linkTweetMedia.mockResolvedValue(undefined);
      mockTweetsRepository.validateReferences.mockResolvedValue({ tweetCount: 0, mediaCount: 2 });
      mockMediaRepository.findOrderedMediaObjectsByIds.mockResolvedValue([
        { url: 'url1', type: 'IMAGE', altText: null, width: 100, height: 100 },
        { url: 'url2', type: 'IMAGE', altText: null, width: 100, height: 100 },
      ]);
      mockUsersRepository.findOwnTweetAuthorMetaData.mockResolvedValue(mockAuthorDto);

      // Act
      const result = await service.createTweet(createTweetDto, userId);

      // Assert
      expect(result.author).toEqual(mockAuthorDto);
      expect(result.media).toEqual([
        { url: 'url1', type: 'IMAGE', altText: null, width: 100, height: 100 },
        { url: 'url2', type: 'IMAGE', altText: null, width: 100, height: 100 },
      ]);
      expect(mockTweetsRepository.linkTweetMedia).toHaveBeenCalledWith(
        BigInt(100),
        [BigInt(1), BigInt(2)],
        mockPrismaService,
      );
    });

    it('should successfully create a quote tweet', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'Quoting this tweet',
        quoteToTweetId: '75',
      };

      mockContentParsingService.parseContentAndValidate.mockResolvedValue({
        mentions: [],
        hashtags: [],
      });
      mockTweetsRepository.create.mockResolvedValue({
        ...mockTweet,
        quotedTweetId: BigInt(75),
      });
      mockTweetsRepository.linkTweetMedia.mockResolvedValue(undefined);
      mockTweetsRepository.validateReferences.mockResolvedValue({ tweetCount: 1, mediaCount: 0 });

      // Act
      const result = await service.createTweet(createTweetDto, userId);

      // Assert
      expect(result.quoteToTweetId).toBe('75');
      expect(mockTweetsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quotedTweetId: BigInt(75),
        }),
        mockPrismaService,
      );
    });

    it('should successfully create a media-only tweet', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: '',
        media: ['1'],
      };

      const returnedTweet = {
        ...mockTweet,
        id: BigInt(101),
        content: '',
      };

      mockContentParsingService.parseContentAndValidate.mockResolvedValue({
        mentions: [],
        hashtags: [],
      });
      mockTweetsRepository.create.mockResolvedValue(returnedTweet);
      mockTweetsRepository.linkTweetMedia.mockResolvedValue(undefined);
      mockTweetsRepository.validateReferences.mockResolvedValue({ tweetCount: 0, mediaCount: 1 });
      mockMediaRepository.findOrderedMediaObjectsByIds.mockResolvedValue([
        { url: 'url1', type: 'IMAGE', altText: null, width: 100, height: 100 },
      ]);

      // Act
      const result = await service.createTweet(createTweetDto, userId);

      // Assert
      expect(result.content).toBe('');
      expect(result.media).toEqual([
        { url: 'url1', type: 'IMAGE', altText: null, width: 100, height: 100 },
      ]);
      expect(mockContentParsingService.parseContentAndValidate).toHaveBeenCalledWith(
        '',
        mockPrismaService,
      );
    });

    it('should throw NOT_FOUND when quote tweet does not exist', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'Quote non-existent tweet',
        quoteToTweetId: '888',
      };

      mockTweetsRepository.validateReferences.mockResolvedValue({ tweetCount: 0, mediaCount: 0 });

      // Act & Assert
      await expect(service.createTweet(createTweetDto, userId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw BAD_REQUEST when no content and empty media array provided', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: '',
        media: [],
      };

      // Act & Assert
      await expect(service.createTweet(createTweetDto, userId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.INVALID_TWEET_PAYLOAD,
            code: TWEETS_ERROR_CODES.INVALID_TWEET_PAYLOAD,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should successfully create tweet with maximum allowed media (4 items)', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'Four photos!',
        media: ['1', '2', '3', '4'],
      };

      mockContentParsingService.parseContentAndValidate.mockResolvedValue({
        mentions: [],
        hashtags: [],
      });
      mockTweetsRepository.create.mockResolvedValue(mockTweet);
      mockTweetsRepository.linkTweetMedia.mockResolvedValue(undefined);
      mockTweetsRepository.validateReferences.mockResolvedValue({ tweetCount: 0, mediaCount: 4 });
      mockMediaRepository.findOrderedMediaObjectsByIds.mockResolvedValue([
        { url: 'url1', type: 'IMAGE', altText: null, width: 100, height: 100 },
        { url: 'url2', type: 'VIDEO', altText: null, width: 100, height: 100 },
        { url: 'url3', type: 'IMAGE', altText: null, width: 100, height: 100 },
        { url: 'url4', type: 'IMAGE', altText: null, width: 100, height: 100 },
      ]);

      // Act
      const result = await service.createTweet(createTweetDto, userId);

      // Assert
      expect(result.media).toEqual([
        { url: 'url1', type: 'IMAGE', altText: null, width: 100, height: 100 },
        { url: 'url2', type: 'VIDEO', altText: null, width: 100, height: 100 },
        { url: 'url3', type: 'IMAGE', altText: null, width: 100, height: 100 },
        { url: 'url4', type: 'IMAGE', altText: null, width: 100, height: 100 },
      ]);
    });

    it('should handle content parsing service errors', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'Tweet with parsing error',
      };

      const parsingError = new Error('Content parsing failed');
      mockContentParsingService.parseContentAndValidate.mockRejectedValue(parsingError);

      // Act & Assert
      await expect(service.createTweet(createTweetDto, userId)).rejects.toThrow(parsingError);
    });

    it('should handle tweet creation repository errors', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'Tweet creation will fail',
      };

      mockContentParsingService.parseContentAndValidate.mockResolvedValue({
        mentions: [],
        hashtags: [],
      });
      const repoError = new Error('Tweet creation failed');
      mockTweetsRepository.create.mockRejectedValue(repoError);

      // Act & Assert
      await expect(service.createTweet(createTweetDto, userId)).rejects.toThrow(repoError);
    });

    it('should throw BAD_REQUEST when both reply and quote are provided', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'Invalid tweet',
        replyToTweetId: '50',
        quoteToTweetId: '75',
      };

      // Act & Assert
      await expect(service.createTweet(createTweetDto, userId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.INVALID_TWEET_CREATION,
            code: TWEETS_ERROR_CODES.INVALID_TWEET_CREATION,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when no content and no media provided', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = { content: '' };

      // Act & Assert
      await expect(service.createTweet(createTweetDto, userId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.INVALID_TWEET_PAYLOAD,
            code: TWEETS_ERROR_CODES.INVALID_TWEET_PAYLOAD,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw BAD_REQUEST when more than 4 media items provided', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'Too much media',
        media: ['1', '2', '3', '4', '5'],
      };

      // Act & Assert
      await expect(service.createTweet(createTweetDto, userId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TOO_MANY_MEDIA,
            code: TWEETS_ERROR_CODES.TOO_MANY_MEDIA,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw NOT_FOUND when reply tweet does not exist', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'Reply to non-existent tweet',
        replyToTweetId: '999',
      };

      mockTweetsRepository.validateReferences.mockResolvedValue({ tweetCount: 0, mediaCount: 0 });

      // Act & Assert
      await expect(service.createTweet(createTweetDto, userId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw BAD_REQUEST when media does not exist', async () => {
      // Arrange
      const createTweetDto: CreateTweetDto = {
        content: 'Tweet with non-existent media',
        media: ['999'],
      };

      mockTweetsRepository.validateReferences.mockResolvedValue({ tweetCount: 0, mediaCount: 0 });

      // Act & Assert
      await expect(service.createTweet(createTweetDto, userId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.INVALID_MEDIA,
            code: TWEETS_ERROR_CODES.INVALID_MEDIA,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('likeTweet', () => {
    const userId = BigInt(1);
    const tweetId = BigInt(100);
    const tweetAuthorId = BigInt(2);

    const mockTweet = {
      id: tweetId,
      userId: tweetAuthorId,
      content: 'Hello',
      hasMedia: false,
      hasHashtags: false,
      hasMentions: false,
      replyToTweetId: null,
      quotedTweetId: null,
      likeCount: 0,
      retweetCount: 0,
      replyCount: 0,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully like a tweet', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockUsersRepository.areUsersBlocked.mockResolvedValue(false);
      mockTweetsRepository.hasUserLikedTweet.mockResolvedValue(false);
      mockTweetsRepository.likeTweet.mockResolvedValue(undefined);

      // Act
      const result = await service.likeTweet(userId, tweetId);

      // Assert
      expect(result).toEqual({ message: 'Tweet liked successfully' });
      expect(mockTweetsRepository.findTweetById).toHaveBeenCalledWith(tweetId);
      expect(mockUsersRepository.areUsersBlocked).toHaveBeenCalledWith(userId, tweetAuthorId);
      expect(mockTweetsRepository.hasUserLikedTweet).toHaveBeenCalledWith(userId, tweetId);
      expect(mockTweetsRepository.likeTweet).toHaveBeenCalledWith(userId, tweetId);
    });

    it('should successfully like own tweet without checking blocks', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: userId, isDeleted: false };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockTweetsRepository.hasUserLikedTweet.mockResolvedValue(false);
      mockTweetsRepository.likeTweet.mockResolvedValue(undefined);

      // Act
      const result = await service.likeTweet(userId, tweetId);

      // Assert
      expect(result).toEqual({ message: 'Tweet liked successfully' });
      expect(mockUsersRepository.areUsersBlocked).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when tweet does not exist', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.likeTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw NOT_FOUND when tweet is deleted', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: true };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);

      // Act & Assert
      await expect(service.likeTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw FORBIDDEN when users are blocked', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: false };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockUsersRepository.areUsersBlocked.mockResolvedValue(true);

      // Act & Assert
      await expect(service.likeTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.USER_BLOCKED,
            code: TWEETS_ERROR_CODES.USER_BLOCKED,
          },
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should throw CONFLICT when tweet is already liked', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: false };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockUsersRepository.areUsersBlocked.mockResolvedValue(false);
      mockTweetsRepository.hasUserLikedTweet.mockResolvedValue(true);

      // Act & Assert
      await expect(service.likeTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.CONFLICTING_LIKE,
            code: TWEETS_ERROR_CODES.CONFLICTING_LIKE,
          },
          HttpStatus.CONFLICT,
        ),
      );
    });
  });

  describe('unlikeTweet', () => {
    const userId = BigInt(1);
    const tweetId = BigInt(100);
    const tweetAuthorId = BigInt(2);

    it('should successfully unlike a tweet', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: false };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockTweetsRepository.hasUserLikedTweet.mockResolvedValue(true);
      mockTweetsRepository.unlikeTweet.mockResolvedValue(undefined);

      // Act
      const result = await service.unlikeTweet(userId, tweetId);

      // Assert
      expect(result).toEqual({ message: 'Tweet unliked successfully' });
      expect(mockTweetsRepository.findTweetById).toHaveBeenCalledWith(tweetId);
      expect(mockTweetsRepository.hasUserLikedTweet).toHaveBeenCalledWith(userId, tweetId);
      expect(mockTweetsRepository.unlikeTweet).toHaveBeenCalledWith(userId, tweetId);
    });

    it('should throw NOT_FOUND when tweet does not exist', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.unlikeTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw NOT_FOUND when tweet is deleted', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: true };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);

      // Act & Assert
      await expect(service.unlikeTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw CONFLICT when tweet is not liked', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: false };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockTweetsRepository.hasUserLikedTweet.mockResolvedValue(false);

      // Act & Assert
      await expect(service.unlikeTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.CONFLICTING_LIKE,
            code: TWEETS_ERROR_CODES.CONFLICTING_LIKE,
          },
          HttpStatus.CONFLICT,
        ),
      );
    });
  });

  describe('retweetTweet', () => {
    const userId = BigInt(1);
    const tweetId = BigInt(100);
    const tweetAuthorId = BigInt(2);

    it('should successfully retweet a tweet', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: false };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockUsersRepository.areUsersBlocked.mockResolvedValue(false);
      mockTweetsRepository.hasUserRetweetedTweet.mockResolvedValue(false);
      mockTweetsRepository.retweetTweet.mockResolvedValue(undefined);

      // Act
      const result = await service.retweetTweet(userId, tweetId);

      // Assert
      expect(result).toEqual({ message: 'Tweet retweeted successfully' });
      expect(mockTweetsRepository.findTweetById).toHaveBeenCalledWith(tweetId);
      expect(mockUsersRepository.areUsersBlocked).toHaveBeenCalledWith(userId, tweetAuthorId);
      expect(mockTweetsRepository.hasUserRetweetedTweet).toHaveBeenCalledWith(userId, tweetId);
      expect(mockTweetsRepository.retweetTweet).toHaveBeenCalledWith(userId, tweetId);
    });

    it('should successfully retweet own tweet without checking blocks', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: userId, isDeleted: false };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockTweetsRepository.hasUserRetweetedTweet.mockResolvedValue(false);
      mockTweetsRepository.retweetTweet.mockResolvedValue(undefined);

      // Act
      const result = await service.retweetTweet(userId, tweetId);

      // Assert
      expect(result).toEqual({ message: 'Tweet retweeted successfully' });
      expect(mockUsersRepository.areUsersBlocked).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when tweet does not exist', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.retweetTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw NOT_FOUND when tweet is deleted', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: true };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);

      // Act & Assert
      await expect(service.retweetTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw FORBIDDEN when users are blocked', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: false };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockUsersRepository.areUsersBlocked.mockResolvedValue(true);

      // Act & Assert
      await expect(service.retweetTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.USER_BLOCKED,
            code: TWEETS_ERROR_CODES.USER_BLOCKED,
          },
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should throw CONFLICT when tweet is already retweeted', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: false };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockUsersRepository.areUsersBlocked.mockResolvedValue(false);
      mockTweetsRepository.hasUserRetweetedTweet.mockResolvedValue(true);

      // Act & Assert
      await expect(service.retweetTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.CONFLICTING_RETWEET,
            code: TWEETS_ERROR_CODES.CONFLICTING_RETWEET,
          },
          HttpStatus.CONFLICT,
        ),
      );
    });
  });

  describe('unretweetTweet', () => {
    const userId = BigInt(1);
    const tweetId = BigInt(100);
    const tweetAuthorId = BigInt(2);

    it('should successfully unretweet a tweet', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: false };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockTweetsRepository.hasUserRetweetedTweet.mockResolvedValue(true);
      mockTweetsRepository.unretweetTweet.mockResolvedValue(undefined);

      // Act
      const result = await service.unretweetTweet(userId, tweetId);

      // Assert
      expect(result).toEqual({ message: 'Tweet unretweeted successfully' });
      expect(mockTweetsRepository.findTweetById).toHaveBeenCalledWith(tweetId);
      expect(mockTweetsRepository.hasUserRetweetedTweet).toHaveBeenCalledWith(userId, tweetId);
      expect(mockTweetsRepository.unretweetTweet).toHaveBeenCalledWith(userId, tweetId);
    });

    it('should throw NOT_FOUND when tweet does not exist', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.unretweetTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw CONFLICT when tweet is not retweeted', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: false };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockTweetsRepository.hasUserRetweetedTweet.mockResolvedValue(false);

      // Act & Assert
      await expect(service.unretweetTweet(userId, tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.CONFLICTING_RETWEET,
            code: TWEETS_ERROR_CODES.CONFLICTING_RETWEET,
          },
          HttpStatus.CONFLICT,
        ),
      );
    });

    it('should allow unretweeting deleted tweets if already retweeted', async () => {
      // Arrange
      const mockTweet = { id: tweetId, userId: tweetAuthorId, isDeleted: true };
      mockTweetsRepository.findTweetById.mockResolvedValue(mockTweet);
      mockTweetsRepository.hasUserRetweetedTweet.mockResolvedValue(true);
      mockTweetsRepository.unretweetTweet.mockResolvedValue(undefined);

      // Act
      const result = await service.unretweetTweet(userId, tweetId);

      // Assert
      expect(result).toEqual({ message: 'Tweet unretweeted successfully' });
    });
  });

  describe('getUserPosts and getUserPostsAndReplies', () => {
    const username = 'testuser';
    const authUserId = BigInt(1);
    const requestedUserId = BigInt(2);
    const limit = 2;

    describe('getUserPosts', () => {
      it('should call getGenericProfileFeed with includeReplies=false', async () => {
        mockUsersRepository.findByUsernameWithDisplayname.mockResolvedValue({
          id: requestedUserId,
          username,
        });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue([]);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue([]);

        const result = await service.getUserPosts(username, authUserId, limit, undefined);

        expect(result).toBeDefined();
        expect(mockTweetsRepository.getFeedSkeletonSQL).toHaveBeenCalledWith(
          requestedUserId,
          limit + 1,
          undefined,
          false, // includeReplies = false
        );
      });
    });

    describe('getUserPostsAndReplies', () => {
      it('should call getGenericProfileFeed with includeReplies=true', async () => {
        mockUsersRepository.findByUsernameWithDisplayname.mockResolvedValue({
          id: requestedUserId,
          username,
        });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue([]);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue([]);

        await service.getUserPostsAndReplies(username, authUserId, limit, undefined);

        expect(mockTweetsRepository.getFeedSkeletonSQL).toHaveBeenCalledWith(
          requestedUserId,
          limit + 1,
          undefined,
          true, // includeReplies = true
        );
      });
    });

    describe('getGenericProfileFeed (via getUserPosts)', () => {
      it('should throw NOT_FOUND when user does not exist', async () => {
        mockUsersRepository.findByUsernameWithDisplayname.mockResolvedValue(null);

        await expect(service.getUserPosts(username, authUserId, limit, undefined)).rejects.toThrow(
          HttpException,
        );
        await expect(
          service.getUserPosts(username, authUserId, limit, undefined),
        ).rejects.toMatchObject({
          status: HttpStatus.NOT_FOUND,
        });
      });

      it('should throw BAD_REQUEST for invalid cursor', async () => {
        mockUsersRepository.findByUsernameWithDisplayname.mockResolvedValue({
          id: requestedUserId,
          username,
        });
        const invalidCursor = 'invalid!!!cursor';

        await expect(
          service.getUserPosts(username, authUserId, limit, invalidCursor),
        ).rejects.toThrow(HttpException);
        await expect(
          service.getUserPosts(username, authUserId, limit, invalidCursor),
        ).rejects.toMatchObject({
          status: HttpStatus.BAD_REQUEST,
        });
      });

      it('should decode valid cursor and pass to repository', async () => {
        const validCursor = encodeCompositeCursor({ id: '123', createdAt: '2024-01-01T00:00:00Z' });
        mockUsersRepository.findByUsernameWithDisplayname.mockResolvedValue({
          id: requestedUserId,
          username,
        });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue([]);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue([]);

        await service.getUserPosts(username, authUserId, limit, validCursor);

        expect(mockTweetsRepository.getFeedSkeletonSQL).toHaveBeenCalledWith(
          requestedUserId,
          limit + 1,
          { id: '123', createdAt: '2024-01-01T00:00:00Z' },
          false,
        );
      });

      it('should handle empty feed', async () => {
        mockUsersRepository.findByUsernameWithDisplayname.mockResolvedValue({
          id: requestedUserId,
          username,
        });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue([]);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue([]);

        const result = await service.getUserPosts(username, authUserId, limit, undefined);

        expect(result.items).toEqual([]);
        expect(result.pagination.hasNextPage).toBe(false);
      });

      it('should filter out null items when tweet data is missing', async () => {
        const feedItems = [
          { id: BigInt(1), type: 'tweet', created_at: '2024-01-01T00:00:00Z' },
          { id: BigInt(999), type: 'tweet', created_at: '2024-01-02T00:00:00Z' },
        ];
        const fullTweets = [{ id: BigInt(1), content: 'Tweet 1' }];
        const tweetDtos = [{ id: '1', content: 'Tweet 1' }];

        mockUsersRepository.findByUsernameWithDisplayname.mockResolvedValue({
          id: requestedUserId,
          username,
        });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue(feedItems);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue(fullTweets);
        mockTweetsRepository.mapToDetailedTweetDto.mockReturnValue(tweetDtos[0]);

        const result = await service.getUserPosts(username, authUserId, limit, undefined);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe('1');
      });

      it('should deduplicate tweet IDs before hydration', async () => {
        const feedItems = [
          { id: BigInt(1), type: 'tweet', created_at: '2024-01-01T00:00:00Z' },
          { id: BigInt(1), type: 'repost', created_at: '2024-01-02T00:00:00Z' },
        ];

        mockUsersRepository.findByUsernameWithDisplayname.mockResolvedValue({
          id: requestedUserId,
          username,
        });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue(feedItems);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue([]);

        await service.getUserPosts(username, authUserId, limit, undefined);

        // Should only hydrate unique IDs (BigInt(1) appears twice but only hydrated once)
        expect(mockTweetsRepository.hydrateTweetsInList).toHaveBeenCalledWith(authUserId, [
          BigInt(1),
        ]);
      });

      it('should preserve createdAt from feed skeleton, not from tweet', async () => {
        const feedCreatedAt = '2024-01-01T12:00:00Z';
        const tweetCreatedAt = '2024-01-01T10:00:00Z';
        const feedItems = [{ id: BigInt(1), type: 'repost', created_at: feedCreatedAt }];
        const fullTweets = [{ id: BigInt(1), content: 'Tweet 1', createdAt: tweetCreatedAt }];
        const tweetDtos = [{ id: '1', content: 'Tweet 1', createdAt: tweetCreatedAt }];

        mockUsersRepository.findByUsernameWithDisplayname.mockResolvedValue({
          id: requestedUserId,
          username,
        });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue(feedItems);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue(fullTweets);
        mockTweetsRepository.mapToDetailedTweetDto.mockReturnValue(tweetDtos[0]);

        const result = await service.getUserPosts(username, authUserId, limit, undefined);

        expect(result.items[0]!.createdAt).toBe(feedCreatedAt);
      });
    });
  });

  describe('getTweet', () => {
    const tweetId = BigInt(1);
    const currentUserId = BigInt(1);

    const mockDetailedTweet = {
      id: tweetId,
      author: {
        username: 'tasneem',
        displayName: 'Tasneem',
        avatarUrl: 'http://cdn-ur.com',
      },
      content: 'Test tweet',
      hasMedia: false,
      hasHashtags: false,
      hasMentions: false,
      likeCount: 10,
      retweetCount: 5,
      replyCount: 2,
      isDeleted: false,
      isLiked: true,
      isRetweeted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      entities: {
        mentions: [
          { username: 'omar', startPosition: '1' },
          { username: 'mostafa', startPosition: '5' },
        ],
        hashtags: [],
      },
      media: [
        {
          url: 'http://media-url.com',
          type: MediaType.IMAGE,
          width: 1024,
          height: 1024,
        },
      ],
      replyToTweetId: '2',
      quoteToTweetId: null,
      rootTweetId: null,
      parentTweets: [],
      rootTweet: null,
    };

    it('should return detailed tweet when found', async () => {
      // Arrange
      mockTweetsRepository.getDetailedTweetById.mockResolvedValue(mockDetailedTweet);
      mockTweetsRepository.getParentTweets.mockResolvedValue([]);
      mockTweetsRepository.getTweetOrDeleted.mockResolvedValue(null);

      // Act
      const result = await service.getTweet(tweetId, currentUserId);

      // Assert
      expect(result).toEqual({
        ...mockDetailedTweet,
        rootTweet: null,
        parentTweets: [],
        hasMoreParents: false,
      });
      expect(mockTweetsRepository.getDetailedTweetById).toHaveBeenCalledWith(
        tweetId,
        currentUserId,
      );
    });

    it('should fetch root tweet and parent tweets for a reply', async () => {
      // Arrange
      const tweetId = BigInt(100);
      const currentUserId = BigInt(1);
      const rootTweetId = '50';
      const replyToTweetId = '75';

      const mockAuthorDto = {
        username: 'tasneem',
        displayName: 'Tasneem',
        avatarUrl: 'http://cdn-ur.com',
      };

      const mockDetailedTweet = {
        id: '100',
        author: mockAuthorDto,
        content: 'Reply tweet',
        createdAt: new Date('2024-01-01'),
        replyCount: 0,
        retweetCount: 0,
        likeCount: 0,
        isLiked: false,
        isRetweeted: false,
        entities: {
          mentions: [],
          hashtags: [],
        },
        media: [],
        replyToTweetId,
        quoteToTweetId: null,
        rootTweetId,
        quotedTweet: undefined,
      };

      const mockRootTweet = {
        id: rootTweetId,
        content: 'Root tweet',
        author: mockAuthorDto,
      };

      const mockParentTweets = [
        {
          id: replyToTweetId,
          content: 'Parent tweet',
          author: mockAuthorDto,
        },
      ];

      mockTweetsRepository.getDetailedTweetById.mockResolvedValue(mockDetailedTweet);
      mockTweetsRepository.getTweetOrDeleted.mockResolvedValue(mockRootTweet);
      mockTweetsRepository.getParentTweets.mockResolvedValue(mockParentTweets);

      // Act
      const result = await service.getTweet(tweetId, currentUserId);

      // Assert
      expect(result.rootTweet).toEqual(mockRootTweet);
      expect(result.parentTweets).toEqual(mockParentTweets);
      expect(result.hasMoreParents).toBe(false);
      expect(mockTweetsRepository.getTweetOrDeleted).toHaveBeenCalledWith(
        BigInt(rootTweetId),
        currentUserId,
      );
      expect(mockTweetsRepository.getParentTweets).toHaveBeenCalledWith(
        BigInt(replyToTweetId),
        currentUserId,
        BigInt(rootTweetId),
      );
    });

    it('should throw NOT_FOUND if tweet does not exist', async () => {
      // Arrange
      mockTweetsRepository.getDetailedTweetById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getTweet(tweetId, currentUserId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should handle deleted parent tweets in thread', async () => {
      // Arrange
      const tweetId = BigInt(100);
      const currentUserId = BigInt(1);
      const replyToTweetId = '75';

      const mockAuthorDto = {
        username: 'tasneem',
        displayName: 'Tasneem',
        avatarUrl: 'http://cdn-ur.com',
      };

      const mockDetailedTweet = {
        id: '100',
        author: mockAuthorDto,
        content: 'Reply tweet',
        createdAt: new Date('2024-01-01'),
        replyCount: 0,
        retweetCount: 0,
        likeCount: 0,
        isLiked: false,
        isRetweeted: false,
        entities: {
          mentions: [],
          hashtags: [],
        },
        media: [],
        replyToTweetId,
        quoteToTweetId: null,
        rootTweetId: null,
        quotedTweet: undefined,
      };

      const mockDeletedParent = {
        id: replyToTweetId,
        isDeleted: true,
      };

      mockTweetsRepository.getDetailedTweetById.mockResolvedValue(mockDetailedTweet);
      mockTweetsRepository.getParentTweets.mockResolvedValue([mockDeletedParent]);
      mockTweetsRepository.getTweetOrDeleted.mockResolvedValue(null);

      // Act
      const result = await service.getTweet(tweetId, currentUserId);

      // Assert
      expect(result.parentTweets).toEqual([mockDeletedParent]);
      expect(result.rootTweet).toBeNull();
    });
  });

  describe('getTweetReplies', () => {
    const tweetId = BigInt(100);
    const currentUserId = BigInt(1);
    const limit = 10;
    // const cursor = 'valid_cursor';
    const validCursor = encodeCompositeCursor({ id: '50', createdAt: '2024-01-01T00:00:00Z' });

    const mockReplies = [
      {
        id: BigInt(20),
        author: {
          username: 'tasneem',
          displayName: 'Tasneem',
          avatarUrl: 'http://cdn-url.com',
        },
        content: 'Test tweet',
        hasMedia: false,
        hasHashtags: false,
        hasMentions: false,
        likeCount: 10,
        retweetCount: 5,
        replyCount: 2,
        isDeleted: false,
        isLiked: true,
        isRetweeted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        entities: {
          mentions: [
            { username: 'omar', startPosition: '1' },
            { username: 'mostafa', startPosition: '5' },
          ],
          hashtags: [],
        },
        media: [
          {
            url: 'http://media-url.com',
            type: MediaType.IMAGE,
            width: 1024,
            height: 1024,
          },
        ],
        replyToTweetId: '2',
        quoteToTweetId: null,
      },
      {
        id: BigInt(21),
        author: {
          username: 'mostafa',
          displayName: 'mostafa',
          avatarUrl: 'http://cdn-url.com',
        },
        content: 'Another test tweet',
        hasMedia: false,
        hasHashtags: false,
        hasMentions: false,
        likeCount: 4,
        retweetCount: 1,
        replyCount: 0,
        isDeleted: false,
        isLiked: false,
        isRetweeted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        entities: {
          mentions: [],
          hashtags: [{ tag: 'testing', startPosition: '10' }],
        },
        media: [],
        replyToTweetId: '2',
        quoteToTweetId: null,
      },
    ];

    it('should return paginated replies', async () => {
      // Arrange
      mockTweetsRepository.getTweetReplies.mockResolvedValue(mockReplies);
      mockTweetsRepository.findTweetById.mockResolvedValue({
        id: tweetId,
        isDeleted: false,
      });

      // Act
      const result = await service.getTweetReplies(tweetId, currentUserId, limit, validCursor);

      // Assert
      expect(mockTweetsRepository.findTweetById).toHaveBeenCalledWith(tweetId);
      expect(mockTweetsRepository.getTweetReplies).toHaveBeenCalledWith(
        tweetId,
        currentUserId,
        limit + 1,
        { id: '50', createdAt: '2024-01-01T00:00:00Z' },
      );
      expect(result.items).toEqual(mockReplies);
      expect(result).toHaveProperty('pagination');
    });

    it('should throw NOT_FOUND if parent tweet does not exist', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getTweetReplies(tweetId, currentUserId, limit, validCursor),
      ).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw BAD_REQUEST if cursor is invalid', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue({ id: tweetId });
      const invalidCursor = 'not-valid-base64!!!';

      // Act & Assert
      await expect(
        service.getTweetReplies(tweetId, currentUserId, limit, invalidCursor),
      ).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.INVALID_CURSOR,
            code: TWEETS_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('getTweetQuotes', () => {
    const tweetId = BigInt(100);
    const currentUserId = BigInt(1);
    const limit = 10;

    const mockQuotes = [
      {
        id: BigInt(20),
        author: {
          username: 'tasneem',
          displayName: 'Tasneem',
          avatarUrl: 'http://cdn-url.com',
        },
        content: 'Test tweet',
        hasMedia: false,
        hasHashtags: false,
        hasMentions: false,
        likeCount: 10,
        retweetCount: 5,
        replyCount: 2,
        isDeleted: false,
        isLiked: true,
        isRetweeted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        entities: {
          mentions: [
            { username: 'omar', startPosition: '1' },
            { username: 'mostafa', startPosition: '5' },
          ],
          hashtags: [],
        },
        media: [
          {
            url: 'http://media-url.com',
            type: MediaType.IMAGE,
            width: 1024,
            height: 1024,
          },
        ],
        replyToTweetId: '2',
        quoteToTweetId: 100,
      },
      {
        id: BigInt(21),
        author: {
          username: 'mostafa',
          displayName: 'mostafa',
          avatarUrl: 'http://cdn-url.com',
        },
        content: 'Another test tweet',
        hasMedia: false,
        hasHashtags: false,
        hasMentions: false,
        likeCount: 4,
        retweetCount: 1,
        replyCount: 0,
        isDeleted: false,
        isLiked: false,
        isRetweeted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        entities: {
          mentions: [],
          hashtags: [{ tag: 'testing', startPosition: '10' }],
        },
        media: [],
        replyToTweetId: '2',
        quoteToTweetId: 100,
      },
    ];

    it('should return paginated quotes', async () => {
      // Arrange
      mockTweetsRepository.getTweetQuotes.mockResolvedValue(mockQuotes);
      mockTweetsRepository.findTweetById.mockResolvedValue({
        id: tweetId,
        isDeleted: false,
      });

      // Act
      const result = await service.getTweetQuotes(tweetId, currentUserId, limit);

      // Assert
      expect(mockTweetsRepository.findTweetById).toHaveBeenCalledWith(tweetId);
      expect(mockTweetsRepository.getTweetQuotes).toHaveBeenCalledWith(
        tweetId,
        currentUserId,
        limit + 1,
        undefined,
      );
      expect(result.items).toEqual(mockQuotes);
      expect(result).toHaveProperty('pagination');
    });
  });

  describe('getTweetLikers', () => {
    const tweetId = BigInt(100);
    const currentUserId = BigInt(1);
    const limit = 10;
    const validCursor = encodeCompositeCursor({ id: '50', createdAt: '2024-01-01T00:00:00Z' });

    it('should successfully fetch likers', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue({ id: tweetId, isDeleted: false });
      const mockLikers = [{ userId: BigInt(50) }];
      mockTweetsRepository.getTweetLikers.mockResolvedValue(mockLikers);

      // Act
      await service.getTweetLikers(tweetId, currentUserId, limit, validCursor);

      // Assert
      expect(mockTweetsRepository.getTweetLikers).toHaveBeenCalledWith(
        tweetId,
        currentUserId,
        limit + 1,
        { id: '50', createdAt: '2024-01-01T00:00:00Z' },
      );
    });

    it('should throw BAD_REQUEST on invalid cursor for likers', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue({ id: tweetId, isDeleted: false });
      const invalidCursor = 'invalid!!!cursor';

      // Act & Assert
      await expect(
        service.getTweetLikers(tweetId, currentUserId, limit, invalidCursor),
      ).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.INVALID_CURSOR,
            code: TWEETS_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('getTweetRetweeters', () => {
    const tweetId = BigInt(100);
    const currentUserId = BigInt(1);
    const limit = 10;

    it('should successfully fetch retweeters', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue({ id: tweetId, isDeleted: false });
      const mockRetweeters = [{ userId: BigInt(60) }];
      mockTweetsRepository.getTweetRetweeters.mockResolvedValue(mockRetweeters);

      // Act
      await service.getTweetRetweeters(tweetId, currentUserId, limit);

      // Assert
      expect(mockTweetsRepository.getTweetRetweeters).toHaveBeenCalledWith(
        tweetId,
        currentUserId,
        limit + 1,
        undefined,
      );
    });
  });

  describe('checkIfTweetExists', () => {
    const tweetId = BigInt(100);

    it('should not throw if tweet exists and is not deleted', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue({ id: tweetId, isDeleted: false });

      // Act & Assert
      await expect(service.checkIfTweetExists(tweetId)).resolves.not.toThrow();
    });

    it('should throw NOT_FOUND if tweet does not exist', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.checkIfTweetExists(tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw NOT_FOUND if tweet is deleted', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue({ id: tweetId, isDeleted: true });

      // Act & Assert
      await expect(service.checkIfTweetExists(tweetId)).rejects.toThrow(
        new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });

  describe('getUserLikedTweets', () => {
    const requestingUserId = BigInt(1);
    const targetUsername = 'testuser';
    const targetUserId = BigInt(2);
    const limit = 10;

    const mockLikedTweets = [
      { id: '100', content: 'Liked tweet 1', createdAt: new Date('2024-01-01') },
      { id: '101', content: 'Liked tweet 2', createdAt: new Date('2024-01-02') },
    ];

    it('should return paginated liked tweets', async () => {
      mockUsersRepository.findByUsername.mockResolvedValue({
        id: targetUserId,
        username: targetUsername,
        deletedAt: null,
      });
      mockTweetsRepository.getUserLikedTweets.mockResolvedValue(mockLikedTweets);

      const result = await service.getUserLikedTweets(
        requestingUserId,
        targetUsername,
        limit,
        undefined,
      );

      expect(mockUsersRepository.findByUsername).toHaveBeenCalledWith(targetUsername);
      expect(mockTweetsRepository.getUserLikedTweets).toHaveBeenCalledWith(
        targetUserId,
        requestingUserId,
        limit + 1,
        undefined,
      );
      expect(result.items).toHaveLength(2);
      expect(result.pagination).toBeDefined();
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      mockUsersRepository.findByUsername.mockResolvedValue(null);

      await expect(
        service.getUserLikedTweets(requestingUserId, targetUsername, limit, undefined),
      ).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw NOT_FOUND when user is deleted', async () => {
      mockUsersRepository.findByUsername.mockResolvedValue({
        id: targetUserId,
        username: targetUsername,
        deletedAt: new Date(),
      });

      await expect(
        service.getUserLikedTweets(requestingUserId, targetUsername, limit, undefined),
      ).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw BAD_REQUEST on invalid cursor', async () => {
      mockUsersRepository.findByUsername.mockResolvedValue({
        id: targetUserId,
        username: targetUsername,
        deletedAt: null,
      });
      const invalidCursor = 'invalid!!!cursor';

      await expect(
        service.getUserLikedTweets(requestingUserId, targetUsername, limit, invalidCursor),
      ).rejects.toThrow(
        new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should decode and pass valid cursor to repository', async () => {
      const validCursor = encodeCompositeCursor({ userId: '2', tweetId: '50' });
      mockUsersRepository.findByUsername.mockResolvedValue({
        id: targetUserId,
        username: targetUsername,
        deletedAt: null,
      });
      mockTweetsRepository.getUserLikedTweets.mockResolvedValue([]);

      await service.getUserLikedTweets(requestingUserId, targetUsername, limit, validCursor);

      expect(mockTweetsRepository.getUserLikedTweets).toHaveBeenCalledWith(
        targetUserId,
        requestingUserId,
        limit + 1,
        { userId: '2', tweetId: '50' },
      );
    });

    it('should correctly limit items when more than limit returned', async () => {
      const elevenTweets = Array.from({ length: 11 }, (_, i) => ({
        id: `${100 + i}`,
        content: `Tweet ${i}`,
        createdAt: new Date(),
      }));

      mockUsersRepository.findByUsername.mockResolvedValue({
        id: targetUserId,
        username: targetUsername,
        deletedAt: null,
      });
      mockTweetsRepository.getUserLikedTweets.mockResolvedValue(elevenTweets);

      const result = await service.getUserLikedTweets(
        requestingUserId,
        targetUsername,
        limit,
        undefined,
      );

      expect(result.items).toHaveLength(10);
      expect(result.pagination.hasNextPage).toBe(true);
    });
  });

  describe('TweetsService - Query Methods', () => {
    const mockTweets = [
      {
        id: BigInt(1),
        content: 'Test tweet 1',
        createdAt: new Date('2024-01-01'),
      },
      {
        id: BigInt(2),
        content: 'Test tweet 2',
        createdAt: new Date('2024-01-02'),
      },
    ];

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TweetsService,
          { provide: TweetsRepository, useValue: mockTweetsRepository },
          { provide: UsersRepository, useValue: mockUsersRepository },
          { provide: ContentParsingService, useValue: mockContentParsingService },
          { provide: MediaRepository, useValue: mockMediaRepository },
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: RedisService, useValue: mockRedisService },
          { provide: TrendingService, useValue: mockTrendingService },
          {
            provide: getQueueToken('timeline-following'),
            useValue: {
              add: jest.fn(),
            },
          },
          {
            provide: RedisService,
            useValue: {
              getClient: jest.fn(),
              del: jest.fn(),
              safeIncr: jest.fn(),
              safeDecr: jest.fn(),
            },
          },
          { provide: DomainEventsService, useValue: mockDomainEventsService },
        ],
      }).compile();

      service = module.get<TweetsService>(TweetsService);
      jest.clearAllMocks();
    });

    describe('getTopTweetsByQuery', () => {
      it('should call getRankedTweetsByQuery with hasMedia=false', async () => {
        const currentUserId = BigInt(1);
        const query = 'test query';
        const limit = 10;

        mockTweetsRepository.getRankedTweetsByQuery.mockResolvedValueOnce(mockTweets);

        await service.getTopTweetsByQuery(currentUserId, query, limit);

        expect(mockTweetsRepository.getRankedTweetsByQuery).toHaveBeenCalledWith(
          currentUserId,
          query,
          false,
          undefined,
          undefined,
          limit + 1,
          undefined,
        );
      });

      it('should pass excludeMutedAndBlocked and peopleFilter to repository', async () => {
        const currentUserId = BigInt(1);
        const query = 'test query';
        const limit = 10;
        const excludeMutedAndBlocked = true;
        const peopleFilter = PeopleSearchFilter.Anyone;

        mockTweetsRepository.getRankedTweetsByQuery.mockResolvedValueOnce(mockTweets);

        await service.getTopTweetsByQuery(
          currentUserId,
          query,
          limit,
          undefined,
          excludeMutedAndBlocked,
          peopleFilter,
        );

        expect(mockTweetsRepository.getRankedTweetsByQuery).toHaveBeenCalledWith(
          currentUserId,
          query,
          false,
          excludeMutedAndBlocked,
          peopleFilter,
          limit + 1,
          undefined,
        );
      });
    });

    describe('getLatestTweetsByQuery', () => {
      it('should call getLatestTweetsByQuery with correct parameters', async () => {
        const currentUserId = BigInt(1);
        const query = 'test query';
        const limit = 10;

        mockTweetsRepository.getLatestTweetsByQuery.mockResolvedValueOnce(mockTweets);

        await service.getLatestTweetsByQuery(currentUserId, query, limit);

        expect(mockTweetsRepository.getLatestTweetsByQuery).toHaveBeenCalledWith(
          currentUserId,
          query,
          undefined,
          undefined,
          limit + 1,
          undefined,
        );
      });

      it('should pass cursor and filters to repository', async () => {
        const currentUserId = BigInt(1);
        const query = 'test query';
        const limit = 10;
        const decodedCursor = {
          type: 'relations' as const,
          createdAt: new Date('2024-01-01'),
          id: '50',
        };
        const excludeMutedAndBlocked = true;

        mockTweetsRepository.getLatestTweetsByQuery.mockResolvedValueOnce(mockTweets);

        await service.getLatestTweetsByQuery(
          currentUserId,
          query,
          limit,
          decodedCursor,
          excludeMutedAndBlocked,
        );

        expect(mockTweetsRepository.getLatestTweetsByQuery).toHaveBeenCalledWith(
          currentUserId,
          query,
          excludeMutedAndBlocked,
          undefined,
          limit + 1,
          decodedCursor,
        );
      });
    });

    describe('getTweetsWithMediaByQuery', () => {
      it('should call getRankedTweetsByQuery with hasMedia=true', async () => {
        const currentUserId = BigInt(1);
        const query = 'test query';
        const limit = 10;

        mockTweetsRepository.getRankedTweetsByQuery.mockResolvedValueOnce(mockTweets);

        await service.getTweetsWithMediaByQuery(currentUserId, query, limit);

        expect(mockTweetsRepository.getRankedTweetsByQuery).toHaveBeenCalledWith(
          currentUserId,
          query,
          true, // hasMedia = true for media tab
          undefined,
          undefined,
          limit + 1,
          undefined,
        );
      });

      it('should pass cursor and filters to repository', async () => {
        const currentUserId = BigInt(1);
        const query = 'test query';
        const limit = 10;
        const decodedCursor = { type: 'rank' as const, rank: '100', id: '50' };
        const excludeMutedAndBlocked = true;

        mockTweetsRepository.getRankedTweetsByQuery.mockResolvedValueOnce(mockTweets);

        await service.getTweetsWithMediaByQuery(
          currentUserId,
          query,
          limit,
          decodedCursor,
          excludeMutedAndBlocked,
        );

        expect(mockTweetsRepository.getRankedTweetsByQuery).toHaveBeenCalledWith(
          currentUserId,
          query,
          true, // hasMedia = true
          excludeMutedAndBlocked,
          undefined,
          limit + 1,
          decodedCursor,
        );
      });
    });
  });

  describe('getUserMediaTweets', () => {
    const username = 'testuser';
    const requestingUserId = BigInt(1);
    const targetUserId = BigInt(2);
    const limit = 10;

    const mockMediaTweets = [
      { id: '100', content: 'Tweet with photo', createdAt: new Date('2024-01-01') },
      { id: '101', content: 'Tweet with video', createdAt: new Date('2024-01-02') },
    ];

    it('should return paginated media tweets', async () => {
      mockUsersRepository.findByUsername.mockResolvedValue({
        id: targetUserId,
        username: username,
        deletedAt: null,
      });
      mockTweetsRepository.getMediaTweetsForUser.mockResolvedValue(mockMediaTweets);

      const result = await service.getUserMediaTweets(requestingUserId, username, limit, undefined);

      expect(mockUsersRepository.findByUsername).toHaveBeenCalledWith(username);
      expect(mockTweetsRepository.getMediaTweetsForUser).toHaveBeenCalledWith(
        targetUserId,
        requestingUserId,
        limit + 1,
        undefined,
      );
      expect(result.items).toHaveLength(2);
      expect(result.pagination).toBeDefined();
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      mockUsersRepository.findByUsername.mockResolvedValue(null);

      await expect(
        service.getUserMediaTweets(requestingUserId, username, limit, undefined),
      ).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw NOT_FOUND when user is deleted', async () => {
      mockUsersRepository.findByUsername.mockResolvedValue({
        id: targetUserId,
        username: username,
        deletedAt: new Date(),
      });

      await expect(
        service.getUserMediaTweets(requestingUserId, username, limit, undefined),
      ).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw BAD_REQUEST on invalid cursor', async () => {
      mockUsersRepository.findByUsername.mockResolvedValue({
        id: targetUserId,
        username: username,
        deletedAt: null,
      });
      const invalidCursor = 'invalid!!!cursor';

      await expect(
        service.getUserMediaTweets(requestingUserId, username, limit, invalidCursor),
      ).rejects.toThrow(
        new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should decode and pass valid cursor to repository', async () => {
      const validCursor = encodeCompositeCursor({ id: '50', createdAt: '2024-01-01T00:00:00Z' });
      mockUsersRepository.findByUsername.mockResolvedValue({
        id: targetUserId,
        username: username,
        deletedAt: null,
      });
      mockTweetsRepository.getMediaTweetsForUser.mockResolvedValue([]);

      await service.getUserMediaTweets(requestingUserId, username, limit, validCursor);

      expect(mockTweetsRepository.getMediaTweetsForUser).toHaveBeenCalledWith(
        targetUserId,
        requestingUserId,
        limit + 1,
        { id: '50', createdAt: '2024-01-01T00:00:00Z' },
      );
    });

    it('should correctly limit items when more than limit returned', async () => {
      const elevenTweets = Array.from({ length: 11 }, (_, i) => ({
        id: `${100 + i}`,
        content: `Media tweet ${i}`,
        createdAt: new Date(),
      }));

      mockUsersRepository.findByUsername.mockResolvedValue({
        id: targetUserId,
        username: username,
        deletedAt: null,
      });
      mockTweetsRepository.getMediaTweetsForUser.mockResolvedValue(elevenTweets);

      const result = await service.getUserMediaTweets(requestingUserId, username, limit, undefined);

      expect(result.items).toHaveLength(10);
      expect(result.pagination.hasNextPage).toBe(true);
    });
  });
});
