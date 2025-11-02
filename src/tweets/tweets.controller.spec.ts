import { Test, TestingModule } from '@nestjs/testing';
import { TweetsController } from './tweets.controller';
import { TweetsService } from './tweets.service';
import type { RequestUser } from 'src/auth/types';

describe('TweetsController', () => {
  let controller: TweetsController;

  const mockTweetsService = {
    likeTweet: jest.fn(),
    unlikeTweet: jest.fn(),
    retweetTweet: jest.fn(),
    unretweetTweet: jest.fn(),
    getTimeline: jest.fn(),
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
});
