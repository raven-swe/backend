import { Test, TestingModule } from '@nestjs/testing';
import { TimelineEventsService } from 'src/tweets/timeline/timeline.events.service';
import { RedisService } from 'src/redis/redis.service';
import { UsersRepository } from 'src/users/users.repository';
import { SseEventsService } from 'src/sse/sse-events.service';

describe('TimelineEventsService', () => {
  let service: TimelineEventsService;

  const mockMulti = {
    zrevrange: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  const mockRedisClient = {
    smembers: jest.fn(),
    multi: jest.fn().mockReturnValue(mockMulti),
    del: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockUsersRepository = {
    findAvatarUrlsByUserIds: jest.fn(),
  };

  const mockSseEventsService = {
    publishTimelineFollowingTweets: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineEventsService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: SseEventsService, useValue: mockSseEventsService },
      ],
    }).compile();

    service = module.get<TimelineEventsService>(TimelineEventsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleNewTweetsCheck', () => {
    it('should skip check when no users are online', async () => {
      mockRedisClient.smembers.mockResolvedValue([]);

      await service.handleNewTweetsCheck();

      expect(mockRedisClient.smembers).toHaveBeenCalled();
      expect(mockRedisClient.multi).not.toHaveBeenCalled();
      expect(mockUsersRepository.findAvatarUrlsByUserIds).not.toHaveBeenCalled();
    });

    it('should process online users with new tweet indicators', async () => {
      mockRedisClient.smembers.mockResolvedValue(['123', '456']);
      mockMulti.exec.mockResolvedValue([
        [null, ['789', '101']],
        [null, 1],
      ]);
      mockUsersRepository.findAvatarUrlsByUserIds.mockResolvedValue(
        new Map([
          ['789', 'https://example.com/avatar1.jpg'],
          ['101', 'https://example.com/avatar2.jpg'],
        ]),
      );
      mockSseEventsService.publishTimelineFollowingTweets.mockResolvedValue(undefined);
      mockRedisClient.del.mockResolvedValue(undefined);

      await service.handleNewTweetsCheck();

      expect(mockRedisClient.smembers).toHaveBeenCalled();
      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockMulti.zrevrange).toHaveBeenCalled();
      expect(mockMulti.del).toHaveBeenCalled();
      expect(mockMulti.exec).toHaveBeenCalled();
      expect(mockUsersRepository.findAvatarUrlsByUserIds).toHaveBeenCalled();
      expect(mockSseEventsService.publishTimelineFollowingTweets).toHaveBeenCalled();
    });

    it('should skip user when no new actor IDs exist', async () => {
      mockRedisClient.smembers.mockResolvedValue(['123']);
      mockMulti.exec.mockResolvedValue([
        [null, []],
        [null, 0],
      ]);

      await service.handleNewTweetsCheck();

      expect(mockUsersRepository.findAvatarUrlsByUserIds).not.toHaveBeenCalled();
      expect(mockSseEventsService.publishTimelineFollowingTweets).not.toHaveBeenCalled();
    });

    it('should handle transaction error gracefully', async () => {
      mockRedisClient.smembers.mockResolvedValue(['123']);
      mockMulti.exec.mockResolvedValue([
        [new Error('Transaction error'), null],
        [null, 0],
      ]);

      await service.handleNewTweetsCheck();

      expect(mockUsersRepository.findAvatarUrlsByUserIds).not.toHaveBeenCalled();
      expect(mockSseEventsService.publishTimelineFollowingTweets).not.toHaveBeenCalled();
    });

    it('should handle null transaction result', async () => {
      mockRedisClient.smembers.mockResolvedValue(['123']);
      mockMulti.exec.mockResolvedValue(null);

      await service.handleNewTweetsCheck();

      expect(mockUsersRepository.findAvatarUrlsByUserIds).not.toHaveBeenCalled();
    });

    it('should handle errors per user without affecting others', async () => {
      mockRedisClient.smembers.mockResolvedValue(['123', '456']);
      mockMulti.exec
        .mockRejectedValueOnce(new Error('Redis error for user 123'))
        .mockResolvedValueOnce([
          [null, ['789']],
          [null, 1],
        ]);
      mockUsersRepository.findAvatarUrlsByUserIds.mockResolvedValue(
        new Map([['789', 'https://example.com/avatar.jpg']]),
      );
      mockSseEventsService.publishTimelineFollowingTweets.mockResolvedValue(undefined);
      mockRedisClient.del.mockResolvedValue(undefined);

      await service.handleNewTweetsCheck();

      expect(mockSseEventsService.publishTimelineFollowingTweets).toHaveBeenCalledWith(
        BigInt('456'),
        expect.any(Array),
      );
    });

    it('should limit actor IDs to 3', async () => {
      mockRedisClient.smembers.mockResolvedValue(['123']);
      mockMulti.exec.mockResolvedValue([
        [null, ['1', '2', '3', '4', '5']],
        [null, 1],
      ]);
      mockUsersRepository.findAvatarUrlsByUserIds.mockResolvedValue(
        new Map([
          ['1', 'avatar1'],
          ['2', 'avatar2'],
          ['3', 'avatar3'],
        ]),
      );
      mockSseEventsService.publishTimelineFollowingTweets.mockResolvedValue(undefined);
      mockRedisClient.del.mockResolvedValue(undefined);

      await service.handleNewTweetsCheck();

      expect(mockUsersRepository.findAvatarUrlsByUserIds).toHaveBeenCalledWith([
        BigInt('1'),
        BigInt('2'),
        BigInt('3'),
      ]);
    });

    it('should order avatars according to actor IDs', async () => {
      mockRedisClient.smembers.mockResolvedValue(['123']);
      mockMulti.exec.mockResolvedValue([
        [null, ['3', '1', '2']],
        [null, 1],
      ]);
      mockUsersRepository.findAvatarUrlsByUserIds.mockResolvedValue(
        new Map([
          ['1', 'avatar1'],
          ['2', 'avatar2'],
          ['3', 'avatar3'],
        ]),
      );
      mockSseEventsService.publishTimelineFollowingTweets.mockResolvedValue(undefined);
      mockRedisClient.del.mockResolvedValue(undefined);

      await service.handleNewTweetsCheck();

      expect(mockSseEventsService.publishTimelineFollowingTweets).toHaveBeenCalledWith(
        BigInt('123'),
        ['avatar3', 'avatar1', 'avatar2'],
      );
    });

    it('should delete indicator key after publishing', async () => {
      mockRedisClient.smembers.mockResolvedValue(['123']);
      mockMulti.exec.mockResolvedValue([
        [null, ['789']],
        [null, 1],
      ]);
      mockUsersRepository.findAvatarUrlsByUserIds.mockResolvedValue(new Map([['789', 'avatar']]));
      mockSseEventsService.publishTimelineFollowingTweets.mockResolvedValue(undefined);
      mockRedisClient.del.mockResolvedValue(undefined);

      await service.handleNewTweetsCheck();

      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    it('should handle non-array exec result', async () => {
      mockRedisClient.smembers.mockResolvedValue(['123']);
      mockMulti.exec.mockResolvedValue('not an array');

      await service.handleNewTweetsCheck();

      expect(mockUsersRepository.findAvatarUrlsByUserIds).not.toHaveBeenCalled();
    });

    it('should handle exec result with non-array actor IDs', async () => {
      mockRedisClient.smembers.mockResolvedValue(['123']);
      mockMulti.exec.mockResolvedValue([
        [null, 'not an array'],
        [null, 0],
      ]);

      await service.handleNewTweetsCheck();

      expect(mockUsersRepository.findAvatarUrlsByUserIds).not.toHaveBeenCalled();
    });
  });
});
