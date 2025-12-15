import { Test, TestingModule } from '@nestjs/testing';
import { TweetsController } from 'src/tweets/tweets.controller';
import { TweetsService } from 'src/tweets/tweets.service';
import type { RequestUser } from 'src/common/interfaces';

describe('TweetsController', () => {
  let controller: TweetsController;

  const mockTweetsService = {
    createTweet: jest.fn(),
    deleteTweet: jest.fn(),
    likeTweet: jest.fn(),
    unlikeTweet: jest.fn(),
    retweetTweet: jest.fn(),
    unretweetTweet: jest.fn(),
    getTimeline: jest.fn(),
    getTweet: jest.fn(),
    getTweetQuotes: jest.fn(),
    getTweetRetweeters: jest.fn(),
    getTweetLikers: jest.fn(),
    getTweetReplies: jest.fn(),
    getTweetSummary: jest.fn(),
  };

  const mockUser: RequestUser = {
    id: '123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TweetsController],
      providers: [
        {
          provide: TweetsService,
          useValue: mockTweetsService,
        },
      ],
    }).compile();

    controller = module.get<TweetsController>(TweetsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTweet', () => {
    it('should call tweetsService.createTweet with correct parameters', async () => {
      const createTweetDto = {
        content: 'Hello World',
      };
      const expectedResponse = { id: BigInt(100), text: 'Hello World' };
      mockTweetsService.createTweet.mockResolvedValue(expectedResponse);

      const result = await controller.createTweet(mockUser, createTweetDto);

      expect(mockTweetsService.createTweet).toHaveBeenCalledWith(createTweetDto, BigInt(123));
      expect(mockTweetsService.createTweet).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const createTweetDto = {
        content: 'Hello World',
      };
      const error = new Error('Failed to create tweet');
      mockTweetsService.createTweet.mockRejectedValue(error);

      await expect(controller.createTweet(mockUser, createTweetDto)).rejects.toThrow(error);
    });
  });

  describe('deleteTweet', () => {
    it('should call tweetsService.deleteTweet with correct parameters', async () => {
      const tweetId = BigInt(100);
      const expectedResponse = { message: 'Tweet deleted successfully' };
      mockTweetsService.deleteTweet.mockResolvedValue(expectedResponse);

      const result = await controller.deleteTweet(mockUser, tweetId);

      expect(mockTweetsService.deleteTweet).toHaveBeenCalledWith(tweetId, BigInt(123));
      expect(mockTweetsService.deleteTweet).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const tweetId = BigInt(100);
      const error = new Error('Tweet not found');
      mockTweetsService.deleteTweet.mockRejectedValue(error);

      await expect(controller.deleteTweet(mockUser, tweetId)).rejects.toThrow(error);
    });
  });

  describe('likeTweet', () => {
    it('should call mockTweetsService.likeTweet with correct parameters', async () => {
      const tweetId = BigInt(100);
      const expectedResponse = { message: 'Tweet liked successfully' };
      mockTweetsService.likeTweet.mockResolvedValue(expectedResponse);

      const result = await controller.likeTweet(mockUser, tweetId);

      expect(mockTweetsService.likeTweet).toHaveBeenCalledWith(BigInt(123), tweetId);
      expect(mockTweetsService.likeTweet).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const tweetId = BigInt(100);
      const error = new Error('Tweet not found');
      mockTweetsService.likeTweet.mockRejectedValue(error);

      await expect(controller.likeTweet(mockUser, tweetId)).rejects.toThrow(error);
    });
  });

  describe('unlikeTweet', () => {
    it('should call mockTweetsService.unlikeTweet with correct parameters', async () => {
      const tweetId = BigInt(100);
      const expectedResponse = { message: 'Tweet unliked successfully' };
      mockTweetsService.unlikeTweet.mockResolvedValue(expectedResponse);

      const result = await controller.unlikeTweet(mockUser, tweetId);

      expect(mockTweetsService.unlikeTweet).toHaveBeenCalledWith(BigInt(123), tweetId);
      expect(mockTweetsService.unlikeTweet).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const tweetId = BigInt(100);
      const error = new Error('Tweet not found');
      mockTweetsService.unlikeTweet.mockRejectedValue(error);

      await expect(controller.unlikeTweet(mockUser, tweetId)).rejects.toThrow(error);
    });
  });

  describe('retweetTweet', () => {
    it('should call mockTweetsService.retweetTweet with correct parameters', async () => {
      const tweetId = BigInt(100);
      const expectedResponse = { message: 'Tweet retweeted successfully' };
      mockTweetsService.retweetTweet.mockResolvedValue(expectedResponse);

      const result = await controller.retweetTweet(mockUser, tweetId);

      expect(mockTweetsService.retweetTweet).toHaveBeenCalledWith(BigInt(123), tweetId);
      expect(mockTweetsService.retweetTweet).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const tweetId = BigInt(100);
      const error = new Error('User blocked');
      mockTweetsService.retweetTweet.mockRejectedValue(error);

      await expect(controller.retweetTweet(mockUser, tweetId)).rejects.toThrow(error);
    });
  });

  describe('unretweetTweet', () => {
    it('should call mockTweetsService.unretweetTweet with correct parameters', async () => {
      const tweetId = BigInt(100);
      const expectedResponse = { message: 'Tweet unretweeted successfully' };
      mockTweetsService.unretweetTweet.mockResolvedValue(expectedResponse);

      const result = await controller.unretweetTweet(mockUser, tweetId);

      expect(mockTweetsService.unretweetTweet).toHaveBeenCalledWith(BigInt(123), tweetId);
      expect(mockTweetsService.unretweetTweet).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const tweetId = BigInt(100);
      const error = new Error('Tweet not retweeted');
      mockTweetsService.unretweetTweet.mockRejectedValue(error);

      await expect(controller.unretweetTweet(mockUser, tweetId)).rejects.toThrow(error);
    });
  });

  describe('getTweet', () => {
    it('should call mockTweetsService.getTweet with correct parameters', async () => {
      const tweetId = BigInt(100);
      const expectedResponse = { id: tweetId, content: 'Hello World' };
      mockTweetsService.getTweet.mockResolvedValue(expectedResponse);

      const result = await controller.getTweet(mockUser, tweetId);

      expect(mockTweetsService.getTweet).toHaveBeenCalledWith(tweetId, BigInt(123));
      expect(mockTweetsService.getTweet).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const tweetId = BigInt(100);
      const error = new Error('Tweet not found');
      mockTweetsService.getTweet.mockRejectedValue(error);

      await expect(controller.getTweet(mockUser, tweetId)).rejects.toThrow(error);
    });
  });

  describe('getTweetQuotes', () => {
    const tweetId = BigInt(100);
    const cursor = 'valid-cursor';
    const expectedResponse = { quotes: [] };

    it('should call service with parsed limit when provided', async () => {
      const limit = '10';
      mockTweetsService.getTweetQuotes.mockResolvedValue(expectedResponse);

      const result = await controller.getTweetQuotes(tweetId, mockUser, limit, cursor);

      expect(mockTweetsService.getTweetQuotes).toHaveBeenCalledWith(
        tweetId,
        BigInt(123),
        10,
        cursor,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should call service with default limit (20) when limit is undefined', async () => {
      // This covers the "else" branch of the ternary operator
      mockTweetsService.getTweetQuotes.mockResolvedValue(expectedResponse);

      const result = await controller.getTweetQuotes(tweetId, mockUser, undefined, cursor);

      expect(mockTweetsService.getTweetQuotes).toHaveBeenCalledWith(
        tweetId,
        BigInt(123),
        20, // Default value check
        cursor,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Tweet not found');
      mockTweetsService.getTweetQuotes.mockRejectedValue(error);

      await expect(controller.getTweetQuotes(tweetId, mockUser, '10', cursor)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getTweetRetweeters', () => {
    const tweetId = BigInt(100);
    const cursor = 'valid-cursor';
    const expectedResponse = { retweeters: [] };

    it('should call service with parsed limit when provided', async () => {
      const limit = '10';
      mockTweetsService.getTweetRetweeters.mockResolvedValue(expectedResponse);

      const result = await controller.getTweetRetweeters(tweetId, mockUser, limit, cursor);

      expect(mockTweetsService.getTweetRetweeters).toHaveBeenCalledWith(
        tweetId,
        BigInt(123),
        10,
        cursor,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should call service with default limit (20) when limit is undefined', async () => {
      mockTweetsService.getTweetRetweeters.mockResolvedValue(expectedResponse);

      const result = await controller.getTweetRetweeters(tweetId, mockUser, undefined, cursor);

      expect(mockTweetsService.getTweetRetweeters).toHaveBeenCalledWith(
        tweetId,
        BigInt(123),
        20,
        cursor,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Tweet not found');
      mockTweetsService.getTweetRetweeters.mockRejectedValue(error);

      await expect(controller.getTweetRetweeters(tweetId, mockUser, '10', cursor)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getTweetLikers', () => {
    const tweetId = BigInt(100);
    const cursor = 'valid-cursor';
    const expectedResponse = { likers: [] };

    it('should call service with parsed limit when provided', async () => {
      const limit = '10';
      mockTweetsService.getTweetLikers.mockResolvedValue(expectedResponse);

      const result = await controller.getTweetLikers(tweetId, mockUser, limit, cursor);

      expect(mockTweetsService.getTweetLikers).toHaveBeenCalledWith(
        tweetId,
        BigInt(123),
        10,
        cursor,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should call service with default limit (20) when limit is undefined', async () => {
      mockTweetsService.getTweetLikers.mockResolvedValue(expectedResponse);

      const result = await controller.getTweetLikers(tweetId, mockUser, undefined, cursor);

      expect(mockTweetsService.getTweetLikers).toHaveBeenCalledWith(
        tweetId,
        BigInt(123),
        20, // Default value check
        cursor,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Tweet not found');
      mockTweetsService.getTweetLikers.mockRejectedValue(error);

      await expect(controller.getTweetLikers(tweetId, mockUser, '10', cursor)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getTweetReplies', () => {
    const tweetId = BigInt(100);
    const cursor = 'valid-cursor';
    const expectedResponse = { replies: [] };

    it('should call service with parsed limit when provided', async () => {
      const limit = '10';
      mockTweetsService.getTweetReplies.mockResolvedValue(expectedResponse);

      const result = await controller.getTweetReplies(tweetId, mockUser, limit, cursor);

      expect(mockTweetsService.getTweetReplies).toHaveBeenCalledWith(
        tweetId,
        BigInt(123),
        10,
        cursor,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should call service with default limit (20) when limit is undefined', async () => {
      mockTweetsService.getTweetReplies.mockResolvedValue(expectedResponse);

      const result = await controller.getTweetReplies(tweetId, mockUser, undefined, cursor);

      expect(mockTweetsService.getTweetReplies).toHaveBeenCalledWith(
        tweetId,
        BigInt(123),
        20, // Default value check
        cursor,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Tweet not found');
      mockTweetsService.getTweetReplies.mockRejectedValue(error);

      await expect(controller.getTweetReplies(tweetId, mockUser, '10', cursor)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getTweetSummary', () => {
    const tweetId = BigInt(100);
    const expectedResponse = { summary: 'This is a summary' };

    it('should call service with default locale en-US when no locale provided', async () => {
      mockTweetsService.getTweetSummary.mockResolvedValue(expectedResponse);

      const result = await controller.getTweetSummary(tweetId);

      expect(mockTweetsService.getTweetSummary).toHaveBeenCalledWith(tweetId, 'en-US');
      expect(result).toEqual(expectedResponse);
    });

    it('should call service with provided locale when valid', async () => {
      mockTweetsService.getTweetSummary.mockResolvedValue(expectedResponse);

      const result = await controller.getTweetSummary(tweetId, 'ar-EG');

      expect(mockTweetsService.getTweetSummary).toHaveBeenCalledWith(tweetId, 'ar-EG');
      expect(result).toEqual(expectedResponse);
    });

    it('should default to en-US when invalid locale provided', async () => {
      mockTweetsService.getTweetSummary.mockResolvedValue(expectedResponse);

      const result = await controller.getTweetSummary(tweetId, 'fr-FR');

      expect(mockTweetsService.getTweetSummary).toHaveBeenCalledWith(tweetId, 'en-US');
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Tweet not found');
      mockTweetsService.getTweetSummary.mockRejectedValue(error);

      await expect(controller.getTweetSummary(tweetId, 'en-US')).rejects.toThrow(error);
    });
  });
});
