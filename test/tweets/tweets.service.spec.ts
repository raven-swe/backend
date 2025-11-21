import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { TweetsService } from 'src/tweets/tweets.service';
import { TweetsRepository } from 'src/tweets/tweets.repository';
import { UsersRepository } from 'src/users/users.repository';
import { TWEETS_ERROR_CODES, TWEETS_ERROR_MESSAGES } from 'src/tweets/constants';
import { PrismaService } from 'src/prisma/prisma.service';

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
    mapToTweetDto: jest.fn(),
  };

  const mockUsersRepository = {
    areUsersBlocked: jest.fn(),
    findByUsername: jest.fn(),
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

  describe('getUserPosts and getUserPostsAndReplies', () => {
    const username = 'testuser';
    const authUserId = BigInt(1);
    const requestedUserId = BigInt(2);
    const limit = 2;

    const encodeValidCursor = (id: string, createdAt: string): string => {
      return Buffer.from(JSON.stringify({ id, createdAt })).toString('base64');
    };

    beforeEach(() => {});

    describe('getUserPosts', () => {
      it('should call getGenericProfileFeed with includeReplies=false', async () => {
        mockUsersRepository.findByUsername.mockResolvedValue({ id: requestedUserId, username });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue([]);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue([]);

        await service.getUserPosts(username, authUserId, limit, undefined);

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
        mockUsersRepository.findByUsername.mockResolvedValue({ id: requestedUserId, username });
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
        mockUsersRepository.findByUsername.mockResolvedValue(null);

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
        mockUsersRepository.findByUsername.mockResolvedValue({ id: requestedUserId, username });
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
        const validCursor = encodeValidCursor('123', '2024-01-01T00:00:00Z');
        mockUsersRepository.findByUsername.mockResolvedValue({ id: requestedUserId, username });
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
        mockUsersRepository.findByUsername.mockResolvedValue({ id: requestedUserId, username });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue([]);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue([]);

        const result = await service.getUserPosts(username, authUserId, limit, undefined);

        expect(result.items).toEqual([]);
        expect(result.pagination.hasNextPage).toBe(false);
      });

      it('should set isRepost=true for repost type items', async () => {
        const feedItems = [
          { id: BigInt(1), type: 'repost', created_at: '2024-01-01T00:00:00Z' },
          { id: BigInt(2), type: 'tweet', created_at: '2024-01-02T00:00:00Z' },
        ];
        const fullTweets = [
          { id: BigInt(1), content: 'Tweet 1' },
          { id: BigInt(2), content: 'Tweet 2' },
        ];
        const tweetDtos = [
          { id: '1', content: 'Tweet 1' },
          { id: '2', content: 'Tweet 2' },
        ];

        mockUsersRepository.findByUsername.mockResolvedValue({ id: requestedUserId, username });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue(feedItems);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue(fullTweets);
        mockTweetsRepository.mapToTweetDto
          .mockReturnValueOnce(tweetDtos[0])
          .mockReturnValueOnce(tweetDtos[1]);

        const result = await service.getUserPosts(username, authUserId, limit, undefined);

        expect(result.items[0]!.isRepost).toBe(true);
        expect(result.items[1]!.isRepost).toBe(false);
      });

      it('should filter out null items when tweet data is missing', async () => {
        const feedItems = [
          { id: BigInt(1), type: 'tweet', created_at: '2024-01-01T00:00:00Z' },
          { id: BigInt(999), type: 'tweet', created_at: '2024-01-02T00:00:00Z' },
        ];
        const fullTweets = [{ id: BigInt(1), content: 'Tweet 1' }];
        const tweetDtos = [{ id: '1', content: 'Tweet 1' }];

        mockUsersRepository.findByUsername.mockResolvedValue({ id: requestedUserId, username });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue(feedItems);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue(fullTweets);
        mockTweetsRepository.mapToTweetDto.mockReturnValue(tweetDtos[0]);

        const result = await service.getUserPosts(username, authUserId, limit, undefined);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe('1');
      });

      it('should deduplicate tweet IDs before hydration', async () => {
        const feedItems = [
          { id: BigInt(1), type: 'tweet', created_at: '2024-01-01T00:00:00Z' },
          { id: BigInt(1), type: 'repost', created_at: '2024-01-02T00:00:00Z' },
        ];

        mockUsersRepository.findByUsername.mockResolvedValue({ id: requestedUserId, username });
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

        mockUsersRepository.findByUsername.mockResolvedValue({ id: requestedUserId, username });
        mockTweetsRepository.getFeedSkeletonSQL.mockResolvedValue(feedItems);
        mockTweetsRepository.hydrateTweetsInList.mockResolvedValue(fullTweets);
        mockTweetsRepository.mapToTweetDto.mockReturnValue(tweetDtos[0]);

        const result = await service.getUserPosts(username, authUserId, limit, undefined);

        expect(result.items[0]!.createdAt).toBe(feedCreatedAt);
      });
    });
  });
});
