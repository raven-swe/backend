import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { TweetsService } from 'src/tweets/tweets.service';
import { SearchService } from 'src/search/search.service';
import { PeopleSearchFilter, SearchTab } from 'src/search/dtos';
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
    searchUsers: jest.fn(),
    getUsersRelationshipsMap: jest.fn(),
  };

  const mockTweetsService = {
    getTopTweetsByQuery: jest.fn(),
    getTweetsWithMediaByQuery: jest.fn(),
    getLatestTweetsByQuery: jest.fn(),
    getTweetsByHashtag: jest.fn(),
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
      rank: 0.95,
    },
    {
      id: BigInt(101),
      content: 'Test tweet 2',
      createdAt: new Date('2024-01-02'),
      rank: 0.85,
    },
  ];

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMatchingUsers', () => {
    it('should return empty array for empty username', async () => {
      const result = await service.getMatchingUsers(currentUserId, '');
      expect(result.users).toEqual([]);
      expect(mockUsersService.getMatchingUsers).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace-only username', async () => {
      const result = await service.getMatchingUsers(currentUserId, '   ');
      expect(result.users).toEqual([]);
      expect(mockUsersService.getMatchingUsers).not.toHaveBeenCalled();
    });

    it('should return empty array when no users found', async () => {
      mockUsersService.getMatchingUsers.mockResolvedValueOnce([]);
      const result = await service.getMatchingUsers(currentUserId, 'john');
      expect(result.users).toEqual([]);
    });

    it('should return empty array when users result is null', async () => {
      mockUsersService.getMatchingUsers.mockResolvedValueOnce(null);
      const result = await service.getMatchingUsers(currentUserId, 'john');
      expect(result.users).toEqual([]);
    });

    it('should return users with follow relations', async () => {
      const mockUsers = [
        {
          id: BigInt(10),
          username: 'john_doe',
          profile: { displayName: 'John Doe', avatarUrl: 'http://avatar1.jpg' },
        },
        {
          id: BigInt(20),
          username: 'jane_smith',
          profile: { displayName: 'Jane Smith', avatarUrl: 'http://avatar2.jpg' },
        },
      ];

      const mockFollowRelations = [
        { followerId: currentUserId, followedId: BigInt(10) }, // currentUser follows user 10
        { followerId: BigInt(20), followedId: currentUserId }, // user 20 follows currentUser
      ];

      mockUsersService.getMatchingUsers.mockResolvedValueOnce(mockUsers);
      mockUsersService.getUserFollowRelations.mockResolvedValueOnce(mockFollowRelations);

      const result = await service.getMatchingUsers(currentUserId, 'john');

      expect(mockUsersService.getMatchingUsers).toHaveBeenCalledWith(currentUserId, 'john');
      expect(mockUsersService.getUserFollowRelations).toHaveBeenCalledWith(currentUserId, [
        BigInt(10),
        BigInt(20),
      ]);

      expect(result.users).toHaveLength(2);
      expect(result.users[0]).toEqual({
        username: 'john_doe',
        displayName: 'John Doe',
        avatarUrl: 'http://avatar1.jpg',
        isFollowing: true,
        isFollower: false,
      });
      expect(result.users[1]).toEqual({
        username: 'jane_smith',
        displayName: 'Jane Smith',
        avatarUrl: 'http://avatar2.jpg',
        isFollowing: false,
        isFollower: true,
      });
    });

    it('should handle users without profile', async () => {
      const mockUsers = [
        {
          id: BigInt(10),
          username: 'no_profile',
          profile: null,
        },
      ];

      mockUsersService.getMatchingUsers.mockResolvedValueOnce(mockUsers);
      mockUsersService.getUserFollowRelations.mockResolvedValueOnce([]);

      const result = await service.getMatchingUsers(currentUserId, 'no_profile');

      expect(result.users[0]).toEqual({
        username: 'no_profile',
        displayName: '',
        avatarUrl: undefined,
        isFollowing: false,
        isFollower: false,
      });
    });

    it('should handle mutual follows correctly', async () => {
      const mockUsers = [
        {
          id: BigInt(10),
          username: 'mutual_friend',
          profile: { displayName: 'Mutual Friend', avatarUrl: 'http://avatar.jpg' },
        },
      ];

      const mockFollowRelations = [
        { followerId: currentUserId, followedId: BigInt(10) },
        { followerId: BigInt(10), followedId: currentUserId },
      ];

      mockUsersService.getMatchingUsers.mockResolvedValueOnce(mockUsers);
      mockUsersService.getUserFollowRelations.mockResolvedValueOnce(mockFollowRelations);

      const result = await service.getMatchingUsers(currentUserId, 'mutual');

      expect(result.users[0]).toEqual({
        username: 'mutual_friend',
        displayName: 'Mutual Friend',
        avatarUrl: 'http://avatar.jpg',
        isFollowing: true,
        isFollower: true,
      });
    });
  });

  describe('searchTweets', () => {
    beforeEach(() => {
      jest.spyOn(SearchUtils, 'prepareSearchQuery').mockImplementation((query) => {
        return query
          .split(' ')
          .map((w) => `${w}:*`)
          .join(' | ');
      });
      jest.spyOn(SearchUtils, 'isSingleHashtagQuery').mockReturnValue(false);
      jest.spyOn(SearchUtils, 'extractHashtag').mockImplementation((q) => q.replace('#', ''));
    });

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

    it('should handle URL encoded queries', async () => {
      const queryDto = {
        query: 'hello%20world',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getTopTweetsByQuery.mockResolvedValueOnce(mockTweets);

      await service.searchTweets(currentUserId, queryDto, limit);

      expect(SearchUtils.prepareSearchQuery).toHaveBeenCalledWith('hello world');
    });

    it('should handle invalid URL encoded queries gracefully', async () => {
      const queryDto = {
        query: 'test%',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getTopTweetsByQuery.mockResolvedValueOnce(mockTweets);

      await service.searchTweets(currentUserId, queryDto, limit);

      expect(SearchUtils.prepareSearchQuery).toHaveBeenCalledWith('test%');
    });

    it('should search for Top tab (default)', async () => {
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
      expect(result.pagination.cursor).toBeNull();
    });

    it('should search for Media tab', async () => {
      const queryDto = {
        query: 'media search',
        tab: SearchTab.Media,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getTweetsWithMediaByQuery.mockResolvedValueOnce(mockTweets);

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
    });

    it('should search for Latest tab', async () => {
      const queryDto = {
        query: 'latest search',
        tab: SearchTab.Latest,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getLatestTweetsByQuery.mockResolvedValueOnce(mockTweets);

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
    });

    it('should default to Top tab if no tab is provided', async () => {
      const queryDto = {
        query: 'default tab search',
        tab: undefined,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getTopTweetsByQuery.mockResolvedValueOnce(mockTweets);

      const result = await service.searchTweets(currentUserId, queryDto, limit);

      expect(mockTweetsService.getTopTweetsByQuery).toHaveBeenCalled();
      expect(result.items).toEqual(mockTweets);
    });

    it('should handle hashtag search for Top tab', async () => {
      jest.spyOn(SearchUtils, 'isSingleHashtagQuery').mockReturnValue(true);
      jest.spyOn(SearchUtils, 'extractHashtag').mockReturnValue('javascript');

      const queryDto = {
        query: '#javascript',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getTweetsByHashtag.mockResolvedValueOnce(mockTweets);

      const result = await service.searchTweets(currentUserId, queryDto, limit);

      expect(mockTweetsService.getTweetsByHashtag).toHaveBeenCalledWith(
        'javascript',
        currentUserId,
        limit,
        false,
        undefined,
        false,
        undefined,
      );

      expect(result.items).toEqual(mockTweets);
    });

    it('should handle hashtag search for Media tab', async () => {
      jest.spyOn(SearchUtils, 'isSingleHashtagQuery').mockReturnValue(true);
      jest.spyOn(SearchUtils, 'extractHashtag').mockReturnValue('photos');

      const queryDto = {
        query: '#photos',
        tab: SearchTab.Media,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getTweetsByHashtag.mockResolvedValueOnce(mockTweets);

      const result = await service.searchTweets(currentUserId, queryDto, limit);

      expect(mockTweetsService.getTweetsByHashtag).toHaveBeenCalledWith(
        'photos',
        currentUserId,
        limit,
        true, // withMedia = true for Media tab
        undefined,
        false,
        undefined,
      );

      expect(result.items).toEqual(mockTweets);
    });

    it('should handle hashtag search for Latest tab', async () => {
      jest.spyOn(SearchUtils, 'isSingleHashtagQuery').mockReturnValue(true);
      jest.spyOn(SearchUtils, 'extractHashtag').mockReturnValue('news');

      const queryDto = {
        query: '#news',
        tab: SearchTab.Latest,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getTweetsByHashtag.mockResolvedValueOnce(mockTweets);

      const result = await service.searchTweets(currentUserId, queryDto, limit);

      expect(mockTweetsService.getTweetsByHashtag).toHaveBeenCalledWith(
        'news',
        currentUserId,
        limit,
        false,
        undefined,
        false,
        undefined,
      );

      expect(result.items).toEqual(mockTweets);
    });

    it('should handle rank cursor for Top tab', async () => {
      const cursor = encodeCompositeCursor({
        type: 'rank',
        rank: '0.95',
        id: '100',
      });

      const queryDto = {
        query: 'pagination test',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getTopTweetsByQuery.mockResolvedValueOnce(mockTweets);

      const result = await service.searchTweets(currentUserId, queryDto, limit, cursor);

      expect(mockTweetsService.getTopTweetsByQuery).toHaveBeenCalledWith(
        currentUserId,
        'pagination:* | test:*',
        limit,
        {
          type: 'rank',
          rank: '0.95',
          id: '100',
        },
        false,
        undefined,
      );

      expect(result.items).toEqual(mockTweets);
    });

    it('should handle relations cursor for Latest tab', async () => {
      const lastTweet = mockTweets[mockTweets.length - 1];
      const cursor = encodeCompositeCursor({
        type: 'relations',
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

      const result = await service.searchTweets(currentUserId, queryDto, limit, cursor);

      expect(mockTweetsService.getLatestTweetsByQuery).toHaveBeenCalledWith(
        currentUserId,
        'pagination:* | test:*',
        limit,
        {
          type: 'relations',
          createdAt: lastTweet.createdAt.toISOString(),
          id: lastTweet.id.toString(),
        },
        false,
        undefined,
      );

      expect(result.items).toEqual(mockTweets);
    });

    it('should throw BAD_REQUEST for invalid cursor', async () => {
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

    it('should throw BAD_REQUEST when using relations cursor for relevance search', async () => {
      const cursor = encodeCompositeCursor({
        type: 'relations',
        createdAt: new Date().toISOString(),
        id: '100',
      });

      const queryDto = {
        query: 'test',
        tab: SearchTab.Top, // Top tab expects rank cursor
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      await expect(service.searchTweets(currentUserId, queryDto, limit, cursor)).rejects.toThrow(
        new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw BAD_REQUEST when using rank cursor for Latest tab', async () => {
      const cursor = encodeCompositeCursor({
        type: 'rank',
        rank: '0.95',
        id: '100',
      });

      const queryDto = {
        query: 'test',
        tab: SearchTab.Latest, // Latest tab expects relations cursor
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      await expect(service.searchTweets(currentUserId, queryDto, limit, cursor)).rejects.toThrow(
        new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should pass excludeMutedAndBlocked flag correctly', async () => {
      const queryDto = {
        query: 'muted blocked test',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: true,
      };

      mockTweetsService.getTopTweetsByQuery.mockResolvedValueOnce(mockTweets);

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
    });

    it('should pass peopleFilter correctly', async () => {
      const peopleFilter = PeopleSearchFilter.Anyone;
      const queryDto = {
        query: 'filter test',
        tab: SearchTab.Top,
        peopleFilter,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getTopTweetsByQuery.mockResolvedValueOnce(mockTweets);

      const result = await service.searchTweets(currentUserId, queryDto, limit);

      expect(mockTweetsService.getTopTweetsByQuery).toHaveBeenCalledWith(
        currentUserId,
        'filter:* | test:*',
        limit,
        undefined,
        false,
        peopleFilter,
      );

      expect(result.items).toEqual(mockTweets);
    });

    it('should generate correct pagination cursor for rank-based search', async () => {
      const tweetsWithRank = [
        { id: BigInt(100), content: 'Test 1', createdAt: new Date(), rank: 0.95 },
        { id: BigInt(101), content: 'Test 2', createdAt: new Date(), rank: 0.85 },
        { id: BigInt(102), content: 'Test 3', createdAt: new Date(), rank: 0.75 },
        { id: BigInt(103), content: 'Test 4', createdAt: new Date(), rank: 0.65 },
        { id: BigInt(104), content: 'Test 5', createdAt: new Date(), rank: 0.55 },
        { id: BigInt(105), content: 'Test 6', createdAt: new Date(), rank: 0.45 },
        { id: BigInt(106), content: 'Test 7', createdAt: new Date(), rank: 0.35 },
        { id: BigInt(107), content: 'Test 8', createdAt: new Date(), rank: 0.25 },
        { id: BigInt(108), content: 'Test 9', createdAt: new Date(), rank: 0.15 },
        { id: BigInt(109), content: 'Test 10', createdAt: new Date(), rank: 0.05 },
        { id: BigInt(110), content: 'Test 11', createdAt: new Date(), rank: 0.04 },
      ];

      const queryDto = {
        query: 'test',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getTopTweetsByQuery.mockResolvedValueOnce(tweetsWithRank);

      const result = await service.searchTweets(currentUserId, queryDto, limit);

      expect(result.pagination).toBeDefined();
      expect(result.pagination.nextCursor).toBeDefined();
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.items.length).toBe(limit);
    });

    it('should generate correct pagination cursor for relations-based search', async () => {
      const tweetsWithDates = [
        { id: BigInt(100), content: 'Test 1', createdAt: new Date('2024-01-10') },
        { id: BigInt(101), content: 'Test 2', createdAt: new Date('2024-01-09') },
        { id: BigInt(102), content: 'Test 3', createdAt: new Date('2024-01-08') },
        { id: BigInt(103), content: 'Test 4', createdAt: new Date('2024-01-07') },
        { id: BigInt(104), content: 'Test 5', createdAt: new Date('2024-01-06') },
        { id: BigInt(105), content: 'Test 6', createdAt: new Date('2024-01-05') },
        { id: BigInt(106), content: 'Test 7', createdAt: new Date('2024-01-04') },
        { id: BigInt(107), content: 'Test 8', createdAt: new Date('2024-01-03') },
        { id: BigInt(108), content: 'Test 9', createdAt: new Date('2024-01-02') },
        { id: BigInt(109), content: 'Test 10', createdAt: new Date('2024-01-01') },
        { id: BigInt(110), content: 'Test 11', createdAt: new Date('2023-12-31') },
      ];

      const queryDto = {
        query: 'test',
        tab: SearchTab.Latest,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockTweetsService.getLatestTweetsByQuery.mockResolvedValueOnce(tweetsWithDates);

      const result = await service.searchTweets(currentUserId, queryDto, limit);

      expect(result.pagination).toBeDefined();
      expect(result.pagination.nextCursor).toBeDefined();
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.items.length).toBe(limit);
    });
  });

  describe('searchUsers', () => {
    const mockSearchUsers = [
      {
        id: '10',
        username: 'john_doe',
        displayName: 'John Doe',
        avatarUrl: 'http://avatar1.jpg',
        rankingScore: '100',
      },
      {
        id: '20',
        username: 'jane_smith',
        displayName: 'Jane Smith',
        avatarUrl: 'http://avatar2.jpg',
        rankingScore: '95',
      },
    ];

    it('should return empty array for empty query', async () => {
      const queryDto = {
        query: '',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      const result = await service.searchUsers(currentUserId, queryDto);

      expect(result.items).toEqual([]);
      expect(result.pagination.cursor).toBeNull();
      expect(mockUsersService.searchUsers).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace-only query', async () => {
      const queryDto = {
        query: '   ',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      const result = await service.searchUsers(currentUserId, queryDto);

      expect(result.items).toEqual([]);
      expect(result.pagination.cursor).toBeNull();
    });

    it('should handle URL encoded queries', async () => {
      const queryDto = {
        query: 'john%20doe',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockUsersService.searchUsers.mockResolvedValueOnce(mockSearchUsers);
      mockUsersService.getUsersRelationshipsMap.mockResolvedValueOnce(new Map());

      await service.searchUsers(currentUserId, queryDto);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith(
        currentUserId,
        'john doe',
        21, // limit + 1
        undefined,
        false,
        undefined,
      );
    });

    it('should handle invalid URL encoded queries gracefully', async () => {
      const queryDto = {
        query: 'test%',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockUsersService.searchUsers.mockResolvedValueOnce(mockSearchUsers);
      mockUsersService.getUsersRelationshipsMap.mockResolvedValueOnce(new Map());

      await service.searchUsers(currentUserId, queryDto);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith(
        currentUserId,
        'test%',
        21,
        undefined,
        false,
        undefined,
      );
    });

    it('should search users successfully', async () => {
      const queryDto = {
        query: 'john',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      const mockRelationships = new Map([
        [BigInt(10), { isFollowing: true, isFollowedBy: false }],
        [BigInt(20), { isFollowing: false, isFollowedBy: true }],
      ]);

      mockUsersService.searchUsers.mockResolvedValueOnce(mockSearchUsers);
      mockUsersService.getUsersRelationshipsMap.mockResolvedValueOnce(mockRelationships);

      const result = await service.searchUsers(currentUserId, queryDto, 20);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith(
        currentUserId,
        'john',
        21, // limit + 1
        undefined,
        false,
        undefined,
      );

      expect(mockUsersService.getUsersRelationshipsMap).toHaveBeenCalledWith(currentUserId, [
        BigInt(10),
        BigInt(20),
      ]);

      expect(result.users).toHaveLength(2);
      expect(result.pagination).toBeDefined();
    });

    it('should handle cursor pagination correctly', async () => {
      const cursor = encodeCompositeCursor({
        rankingScore: '100',
        id: '10',
      });

      const queryDto = {
        query: 'test',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockUsersService.searchUsers.mockResolvedValueOnce(mockSearchUsers);
      mockUsersService.getUsersRelationshipsMap.mockResolvedValueOnce(new Map());

      const result = await service.searchUsers(currentUserId, queryDto, 20, cursor);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith(
        currentUserId,
        'test',
        21,
        {
          rankingScore: '100',
          id: '10',
        },
        false,
        undefined,
      );

      expect(result.users).toHaveLength(2);
    });

    it('should throw BAD_REQUEST for invalid cursor', async () => {
      const queryDto = {
        query: 'test',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      const invalidCursor = 'invalid-cursor';

      await expect(service.searchUsers(currentUserId, queryDto, 20, invalidCursor)).rejects.toThrow(
        new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should pass excludeMutedAndBlocked flag correctly', async () => {
      const queryDto = {
        query: 'test',
        peopleFilter: undefined,
        excludeMutedAndBlocked: true,
      };

      mockUsersService.searchUsers.mockResolvedValueOnce(mockSearchUsers);
      mockUsersService.getUsersRelationshipsMap.mockResolvedValueOnce(new Map());

      await service.searchUsers(currentUserId, queryDto, 20);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith(
        currentUserId,
        'test',
        21,
        undefined,
        true, // excludeMutedAndBlocked
        undefined,
      );
    });

    it('should pass peopleFilter correctly', async () => {
      const peopleFilter = PeopleSearchFilter.Anyone;
      const queryDto = {
        query: 'test',
        peopleFilter,
        excludeMutedAndBlocked: false,
      };

      mockUsersService.searchUsers.mockResolvedValueOnce(mockSearchUsers);
      mockUsersService.getUsersRelationshipsMap.mockResolvedValueOnce(new Map());

      await service.searchUsers(currentUserId, queryDto, 20);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith(
        currentUserId,
        'test',
        21,
        undefined,
        false,
        peopleFilter,
      );
    });

    it('should convert query to lowercase and trim', async () => {
      const queryDto = {
        query: '  JOHN DOE  ',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockUsersService.searchUsers.mockResolvedValueOnce(mockSearchUsers);
      mockUsersService.getUsersRelationshipsMap.mockResolvedValueOnce(new Map());

      await service.searchUsers(currentUserId, queryDto);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith(
        currentUserId,
        'john doe',
        21,
        undefined,
        false,
        undefined,
      );
    });

    it('should use default limit of 20 when not provided', async () => {
      const queryDto = {
        query: 'test',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockUsersService.searchUsers.mockResolvedValueOnce(mockSearchUsers);
      mockUsersService.getUsersRelationshipsMap.mockResolvedValueOnce(new Map());

      await service.searchUsers(currentUserId, queryDto);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith(
        currentUserId,
        'test',
        21, // default 20 + 1
        undefined,
        false,
        undefined,
      );
    });

    it('should handle empty user results', async () => {
      const queryDto = {
        query: 'nonexistent',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockUsersService.searchUsers.mockResolvedValueOnce([]);
      mockUsersService.getUsersRelationshipsMap.mockResolvedValueOnce(new Map());

      const result = await service.searchUsers(currentUserId, queryDto);

      expect(result.users).toEqual([]);
      expect(result.pagination.cursor).toBeNull();
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should generate pagination cursor when results exceed limit', async () => {
      const queryDto = {
        query: 'popular',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      // Return exactly limit + 1 items (21) to trigger pagination
      const manyUsers = Array.from({ length: 21 }, (_, i) => ({
        id: (10 + i).toString(),
        username: `user_${i}`,
        displayName: `User ${i}`,
        avatarUrl: `http://avatar${i}.jpg`,
        rankingScore: (100 - i).toString(),
      }));

      mockUsersService.searchUsers.mockResolvedValueOnce(manyUsers);
      mockUsersService.getUsersRelationshipsMap.mockResolvedValueOnce(new Map());

      const result = await service.searchUsers(currentUserId, queryDto, 20);

      expect(result.users?.length).toBe(20);
      expect(result.pagination.nextCursor).toBeDefined();
      expect(result.pagination.hasNextPage).toBe(true);
    });
  });
});
