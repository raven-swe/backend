import { Test, TestingModule } from '@nestjs/testing';
import { TimelineController } from 'src/tweets/timeline/timeline.controller';
import { TimelineService } from 'src/tweets/timeline/timeline.service';

describe('TimelineController', () => {
  let controller: TimelineController;
  const mockTimelineService: jest.Mocked<Partial<TimelineService>> = {
    getTimeline: jest.fn(),
    getForYouFeed: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimelineController],
      providers: [{ provide: TimelineService, useValue: mockTimelineService }],
    }).compile();

    controller = module.get<TimelineController>(TimelineController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTimeline', () => {
    const mockUser = { id: '123' };
    const mockPagination = { limit: 20, cursor: undefined };

    it('should return timeline tweets successfully', async () => {
      const mockTimelineTweets = {
        items: [
          {
            id: '1',
            content: 'Test tweet',
            author: { id: '456', username: 'testuser' },
          },
        ],
        pagination: { hasNextPage: false, nextCursor: null },
      };

      (mockTimelineService.getTimeline as jest.Mock).mockResolvedValue(mockTimelineTweets);

      const result = await controller.getTimeline(mockPagination, mockUser);

      expect(mockTimelineService.getTimeline).toHaveBeenCalledWith(BigInt('123'), undefined, 20);
      expect(result).toEqual({
        message: 'Timeline retrieved successfully',
        ...mockTimelineTweets,
      });
    });

    it('should pass cursor to service when provided', async () => {
      const paginationWithCursor = { limit: 10, cursor: 'someCursor123' };
      const mockTimelineTweets = {
        items: [],
        pagination: { hasNextPage: false, nextCursor: null },
      };

      (mockTimelineService.getTimeline as jest.Mock).mockResolvedValue(mockTimelineTweets);

      await controller.getTimeline(paginationWithCursor, mockUser);

      expect(mockTimelineService.getTimeline).toHaveBeenCalledWith(
        BigInt('123'),
        'someCursor123',
        10,
      );
    });

    it('should handle empty timeline', async () => {
      const emptyTimeline = {
        items: [],
        pagination: { hasNextPage: false, nextCursor: null },
      };

      (mockTimelineService.getTimeline as jest.Mock).mockResolvedValue(emptyTimeline);

      const result = await controller.getTimeline(mockPagination, mockUser);

      expect(result.items).toEqual([]);
      expect(result.message).toBe('Timeline retrieved successfully');
    });

    it('should propagate service errors', async () => {
      const error = new Error('Service error');
      (mockTimelineService.getTimeline as jest.Mock).mockRejectedValue(error);

      await expect(controller.getTimeline(mockPagination, mockUser)).rejects.toThrow(
        'Service error',
      );
    });
  });

  describe('getForYouTimeline', () => {
    const mockUser = { id: '456' };
    const mockPagination = { limit: 15, cursor: undefined };

    it('should return For You timeline tweets successfully', async () => {
      const mockForYouTweets = {
        items: [
          {
            id: '2',
            content: 'For You tweet',
            author: { id: '789', username: 'forYouUser' },
          },
        ],
        pagination: { hasNextPage: true, nextCursor: 'nextCursor' },
      };

      (mockTimelineService.getForYouFeed as jest.Mock).mockResolvedValue(mockForYouTweets);

      const result = await controller.getForYouTimeline(mockPagination, mockUser);

      expect(mockTimelineService.getForYouFeed).toHaveBeenCalledWith(BigInt('456'), undefined, 15);
      expect(result).toEqual({
        message: 'For You Timeline retrieved successfully',
        ...mockForYouTweets,
      });
    });

    it('should pass cursor to service when provided', async () => {
      const paginationWithCursor = { limit: 25, cursor: 'forYouCursor' };
      const mockForYouTweets = {
        items: [],
        pagination: { hasNextPage: false, nextCursor: null },
      };

      (mockTimelineService.getForYouFeed as jest.Mock).mockResolvedValue(mockForYouTweets);

      await controller.getForYouTimeline(paginationWithCursor, mockUser);

      expect(mockTimelineService.getForYouFeed).toHaveBeenCalledWith(
        BigInt('456'),
        'forYouCursor',
        25,
      );
    });

    it('should handle empty For You timeline', async () => {
      const emptyTimeline = {
        items: [],
        pagination: { hasNextPage: false, nextCursor: null },
      };

      (mockTimelineService.getForYouFeed as jest.Mock).mockResolvedValue(emptyTimeline);

      const result = await controller.getForYouTimeline(mockPagination, mockUser);

      expect(result.items).toEqual([]);
      expect(result.message).toBe('For You Timeline retrieved successfully');
    });

    it('should propagate service errors', async () => {
      const error = new Error('For You service error');
      (mockTimelineService.getForYouFeed as jest.Mock).mockRejectedValue(error);

      await expect(controller.getForYouTimeline(mockPagination, mockUser)).rejects.toThrow(
        'For You service error',
      );
    });

    it('should handle pagination with next page', async () => {
      const mockForYouTweets = {
        items: [{ id: '1' }, { id: '2' }],
        pagination: { hasNextPage: true, nextCursor: 'cursorFor3' },
      };

      (mockTimelineService.getForYouFeed as jest.Mock).mockResolvedValue(mockForYouTweets);

      const result = await controller.getForYouTimeline(mockPagination, mockUser);

      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBe('cursorFor3');
    });
  });
});
