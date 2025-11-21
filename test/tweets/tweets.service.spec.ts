import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { TweetsService } from 'src/tweets/tweets.service';
import { TweetsRepository } from 'src/tweets/tweets.repository';
import { UsersRepository } from 'src/users/users.repository';
import { TWEETS_ERROR_CODES, TWEETS_ERROR_MESSAGES } from 'src/tweets/constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { MediaType } from '@prisma/client';
import {
  decodeCompositeCursor,
  decodeCursor,
  paginateComposite,
  paginateSingle,
} from 'src/common/utils';

jest.mock('src/common/utils', () => ({
  decodeCursor: jest.fn().mockReturnValue(BigInt(0)), // Default return
  decodeCompositeCursor: jest.fn().mockReturnValue({}),
  paginateSingle: jest.fn().mockReturnValue({
    nextCursor: null,
    hasNextPage: false,
  }),
  paginateComposite: jest.fn().mockReturnValue({
    nextCursor: null,
    hasNextPage: false,
  }),
}));

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
    getDetailedTweetById: jest.fn(),
    getTweetLikers: jest.fn(),
    getTweetRetweeters: jest.fn(),
    getTweetReplies: jest.fn(),
    getTweetQuotes: jest.fn(),
  };

  const mockUsersRepository = {
    areUsersBlocked: jest.fn(),
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
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TweetsService>(TweetsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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

  describe('getTimeline', () => {
    const userId = BigInt(1);
    const cursor = 'encoded_cursor';
    const limit = 10;

    it('should successfully fetch and paginate timeline', async () => {
      const decodedCursorId = BigInt(50);
      const rawTweets = [{ id: BigInt(100) }, { id: BigInt(99) }];
      const mockPagination = { nextCursor: 'next_cursor', hasNextPage: true };

      (decodeCursor as jest.Mock).mockReturnValue(decodedCursorId);
      mockTweetsRepository.getTimelineForUser.mockResolvedValue(rawTweets);
      (paginateSingle as jest.Mock).mockReturnValue(mockPagination);

      const result = await service.getTimeline(userId, cursor, limit);

      expect(decodeCursor).toHaveBeenCalledWith(cursor);
      expect(mockTweetsRepository.getTimelineForUser).toHaveBeenCalledWith(
        userId,
        decodedCursorId,
        limit + 1,
      );
      expect(paginateSingle).toHaveBeenCalledWith(rawTweets, limit, cursor, expect.any(Function));
      expect(result).toEqual({ items: rawTweets, pagination: mockPagination });
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
    };

    it('should return detailed tweet when found', async () => {
      // Arrange
      mockTweetsRepository.getDetailedTweetById.mockResolvedValue(mockDetailedTweet);

      // Act
      const result = await service.getTweet(tweetId, currentUserId);

      // Assert
      expect(result).toEqual(mockDetailedTweet);
      expect(mockTweetsRepository.getDetailedTweetById).toHaveBeenCalledWith(
        tweetId,
        currentUserId,
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
  });

  describe('getTweetReplies', () => {
    const tweetId = BigInt(100);
    const currentUserId = BigInt(1);
    const limit = 10;
    const cursor = 'valid_cursor';

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
      const result = await service.getTweetReplies(tweetId, currentUserId, limit, cursor);

      // Assert
      expect(mockTweetsRepository.findTweetById).toHaveBeenCalledWith(tweetId);
      expect(mockTweetsRepository.getTweetReplies).toHaveBeenCalledWith(
        tweetId,
        currentUserId,
        limit + 1,
        expect.anything(),
      );
      expect(result.items).toEqual(mockReplies);
      expect(result).toHaveProperty('pagination');
    });

    it('should throw NOT_FOUND if parent tweet does not exist', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getTweetReplies(tweetId, currentUserId, limit, cursor)).rejects.toThrow(
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
      (decodeCompositeCursor as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid cursor');
      });

      // Act & Assert
      await expect(
        service.getTweetReplies(tweetId, currentUserId, limit, 'invalid_cursor'),
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
    const cursor = 'encoded_cursor';

    it('should successfully fetch likers', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue({ id: tweetId, isDeleted: false });
      (decodeCompositeCursor as jest.Mock).mockReturnValue({});
      const mockLikers = [{ userId: BigInt(50) }];
      mockTweetsRepository.getTweetLikers.mockResolvedValue(mockLikers);
      (paginateComposite as jest.Mock).mockReturnValue({});

      // Act
      const result = await service.getTweetLikers(tweetId, currentUserId, limit, cursor);

      // Assert
      expect(mockTweetsRepository.getTweetLikers).toHaveBeenCalledWith(
        tweetId,
        currentUserId,
        limit + 1,
        {},
      );
      expect(result.items).toEqual(mockLikers);
    });

    it('should throw BAD_REQUEST on invalid cursor for likers', async () => {
      // Arrange
      mockTweetsRepository.findTweetById.mockResolvedValue({ id: tweetId, isDeleted: false });
      (decodeCompositeCursor as jest.Mock).mockImplementation(() => {
        throw new Error();
      });

      // Act & Assert
      await expect(service.getTweetLikers(tweetId, currentUserId, limit, 'bad')).rejects.toThrow(
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
      (paginateComposite as jest.Mock).mockReturnValue({});

      // Act
      const result = await service.getTweetRetweeters(tweetId, currentUserId, limit);

      // Assert
      expect(mockTweetsRepository.getTweetRetweeters).toHaveBeenCalledWith(
        tweetId,
        currentUserId,
        limit + 1,
        undefined,
      );
      expect(result.items).toEqual(mockRetweeters);
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
});
