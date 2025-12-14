import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { TweetsService } from 'src/tweets/tweets.service';
import { SearchService } from 'src/search/search.service';
import { SearchTab } from 'src/search/dtos';
import * as SearchUtils from 'src/search/utils/search-query.util';
import { PAGINATION_ERROR_CODES, PAGINATION_ERROR_MESSAGES } from 'src/common/constants';

const encodeCompositeCursor = (cursorObject: object): string => {
  const jsonString = JSON.stringify(cursorObject);
  return Buffer.from(jsonString).toString('base64');
};

describe('SearchService', () => {
  let service: SearchService;

  const mockUsersService = {
    getMatchingUsers: jest.fn(),
    getUserFollowRelations: jest.fn(),
  };

  const mockTweetsService = {
    getTopTweetsByQuery: jest.fn(),
    getTweetsWithMediaByQuery: jest.fn(),
    getLatestTweetsByQuery: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: TweetsService, useValue: mockTweetsService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const currentUserId = BigInt(1);
  const limit = 10;
  const mockTweets = [
    {
      id: BigInt(100),
      content: 'Test tweet 1',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: BigInt(101),
      content: 'Test tweet 2',
      createdAt: new Date('2024-01-02'),
    },
  ];

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchTweets', () => {
    it('should return empty array for empty query', async () => {
      const queryDto = {
        query: '',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      const result = await service.searchTweets(currentUserId, queryDto, limit);

      expect(result.items).toEqual([]);
      expect(result.pagination).toBeDefined();
    });

    it('should return empty array for whitespace-only query', async () => {
      const queryDto = {
        query: '   ',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      const result = await service.searchTweets(currentUserId, queryDto, limit);

      expect(result.items).toEqual([]);
      expect(result.pagination).toBeDefined();
    });

    it('should clean the search query before processing', async () => {
      const dirtyQuery = '   test search   ';
      const cleanedQuery = 'test:* | search:*';

      const queryDto = {
        query: dirtyQuery,
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };
      (SearchUtils.prepareSearchQuery as jest.Mock) = jest.fn().mockReturnValue(cleanedQuery);

      mockTweetsService.getTopTweetsByQuery.mockResolvedValueOnce([]);

      await service.searchTweets(currentUserId, queryDto, limit);

      expect(SearchUtils.prepareSearchQuery).toHaveBeenCalledWith(dirtyQuery);
      expect(mockTweetsService.getTopTweetsByQuery).toHaveBeenCalledWith(
        currentUserId,
        cleanedQuery,
        limit,
        undefined,
        false,
        undefined,
      );
    });

    it('should search queries for Top tab', async () => {
      const queryDto = {
        query: 'test search',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getTopTweetsByQuery.mockResolvedValueOnce(mockTweets);

      const result = await service.searchTweets(currentUserId, queryDto, limit);

      expect(mockTweetsService.getTopTweetsByQuery).toHaveBeenCalledWith(
        currentUserId,
        'test:* | search:*',
        limit,
        undefined,
        false,
        undefined,
      );

      expect(result.items).toEqual(mockTweets);
      expect(result.pagination).toBeDefined();
    });
  });

  it('should search queries for Media tab', async () => {
    const queryDto = {
      query: 'media search',
      tab: SearchTab.Media,
      peopleFilter: undefined,
      excludeMutedAndBlocked: false,
    };

    mockTweetsService.getTweetsWithMediaByQuery.mockResolvedValueOnce(mockTweets);
    (SearchUtils.prepareSearchQuery as jest.Mock) = jest.fn().mockReturnValue('media:* | search:*');

    const result = await service.searchTweets(currentUserId, queryDto, limit);

    expect(mockTweetsService.getTweetsWithMediaByQuery).toHaveBeenCalledWith(
      currentUserId,
      'media:* | search:*',
      limit,
      undefined,
      false,
      undefined,
    );

    expect(result.items).toEqual(mockTweets);
    expect(result.pagination).toBeDefined();
  });

  it('should search queries for Latest tab', async () => {
    const queryDto = {
      query: 'latest search',
      tab: SearchTab.Latest,
      peopleFilter: undefined,
      excludeMutedAndBlocked: false,
    };

    mockTweetsService.getLatestTweetsByQuery.mockResolvedValueOnce(mockTweets);
    (SearchUtils.prepareSearchQuery as jest.Mock) = jest
      .fn()
      .mockReturnValue('latest:* | search:*');

    const result = await service.searchTweets(currentUserId, queryDto, limit);

    expect(mockTweetsService.getLatestTweetsByQuery).toHaveBeenCalledWith(
      currentUserId,
      'latest:* | search:*',
      limit,
      undefined,
      false,
      undefined,
    );

    expect(result.items).toEqual(mockTweets);
    expect(result.pagination).toBeDefined();
  });

  it('should default to Top tab if no tab is provided', async () => {
    const queryDto = {
      query: 'default tab search',
      tab: undefined,
      peopleFilter: undefined,
      excludeMutedAndBlocked: false,
    };

    mockTweetsService.getTopTweetsByQuery.mockResolvedValueOnce(mockTweets);
    (SearchUtils.prepareSearchQuery as jest.Mock) = jest
      .fn()
      .mockReturnValue('default:* | tab:* | search:*');

    const result = await service.searchTweets(currentUserId, queryDto, limit);

    expect(mockTweetsService.getTopTweetsByQuery).toHaveBeenCalledWith(
      currentUserId,
      'default:* | tab:* | search:*',
      limit,
      undefined,
      false,
      undefined,
    );

    expect(result.items).toEqual(mockTweets);
    expect(result.pagination).toBeDefined();
  });

  it('should handle cursor pagination correctly', async () => {
    const lastTweet = mockTweets[mockTweets.length - 1];
    const cursor = encodeCompositeCursor({
      type: 'relations', // Add type field
      createdAt: lastTweet.createdAt.toISOString(),
      id: lastTweet.id.toString(),
    });

    const queryDto = {
      query: 'pagination test',
      tab: SearchTab.Latest,
      peopleFilter: undefined,
      excludeMutedAndBlocked: false,
    };

    mockTweetsService.getLatestTweetsByQuery.mockResolvedValueOnce(mockTweets);
    (SearchUtils.prepareSearchQuery as jest.Mock) = jest
      .fn()
      .mockReturnValue('pagination:* | test:*');

    const result = await service.searchTweets(currentUserId, queryDto, limit, cursor);

    expect(mockTweetsService.getLatestTweetsByQuery).toHaveBeenCalledWith(
      currentUserId,
      'pagination:* | test:*',
      limit,
      {
        type: 'relations', // Add type field to expected object
        createdAt: lastTweet.createdAt.toISOString(),
        id: lastTweet.id.toString(),
      },
      false,
      undefined,
    );

    expect(result.items).toEqual(mockTweets);
    expect(result.pagination).toBeDefined();
  });

  test('should throw BAD_REQUEST for invalid cursor', async () => {
    const queryDto = {
      query: 'invalid cursor test',
      tab: SearchTab.Top,
      peopleFilter: undefined,
      excludeMutedAndBlocked: false,
    };

    const invalidCursor = 'invalid-cursor-string';

    await expect(
      service.searchTweets(currentUserId, queryDto, limit, invalidCursor),
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

  it('should pass excludedMutedAndBlocked flag correctly to TweetsService', async () => {
    const queryDto = {
      query: 'muted blocked test',
      tab: SearchTab.Top,
      peopleFilter: undefined,
      excludeMutedAndBlocked: true,
    };

    mockTweetsService.getTopTweetsByQuery.mockResolvedValueOnce(mockTweets);
    (SearchUtils.prepareSearchQuery as jest.Mock) = jest
      .fn()
      .mockReturnValue('muted:* | blocked:* | test:*');

    const result = await service.searchTweets(currentUserId, queryDto, limit);

    expect(mockTweetsService.getTopTweetsByQuery).toHaveBeenCalledWith(
      currentUserId,
      'muted:* | blocked:* | test:*',
      limit,
      undefined,
      true,
      undefined,
    );

    expect(result.items).toEqual(mockTweets);
    expect(result.pagination).toBeDefined();
  });
});
