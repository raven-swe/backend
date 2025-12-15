import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from 'src/search/search.controller';
import { SearchService } from 'src/search/search.service';
import { TrendingService } from 'src/trending/trending.service';
import { PeopleSearchFilter, SearchTab, SearchTweetsQueryDto } from 'src/search/dtos';
import { SearchUsersQueryDto } from 'src/search/dtos/search-users-query.dto';
import { QueryDto } from 'src/search/dtos/query.dto';
import { ParseBooleanPipe } from 'src/common/pipes/parse-boolean.pipe';
import { RequestUser } from 'src/common/interfaces';

describe('SearchController', () => {
  let controller: SearchController;

  const mockSearchService = {
    searchTweets: jest.fn(),
    getMatchingUsers: jest.fn(),
    searchUsers: jest.fn(),
  };

  const mockTrendingService = {
    getTrendingWords: jest.fn(),
    getTrendingHashtags: jest.fn(),
  };

  const mockUser: RequestUser = {
    id: '1',
  };

  const mockSearchResult = {
    items: [
      {
        id: BigInt(100),
        content: 'Test tweet 1',
        createdAt: new Date('2024-01-01'),
      },
    ],
    pagination: {
      nextCursor: 'encoded-cursor',
      hasMore: true,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
        { provide: TrendingService, useValue: mockTrendingService },
        ParseBooleanPipe,
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTopUsers', () => {
    it('should call searchService.getMatchingUsers with correct parameters', async () => {
      const queryDto: QueryDto = {
        query: 'john',
      };

      const mockUsersResult = {
        users: [
          {
            username: 'john_doe',
            displayName: 'John Doe',
            avatarUrl: 'http://avatar.jpg',
            isFollowing: false,
            isFollower: false,
          },
        ],
      };

      mockSearchService.getMatchingUsers.mockResolvedValueOnce(mockUsersResult);

      const result = await controller.getTopUsers(mockUser, queryDto);

      expect(mockSearchService.getMatchingUsers).toHaveBeenCalledWith(BigInt(mockUser.id), 'john');
      expect(result).toEqual(mockUsersResult);
    });

    it('should handle empty query', async () => {
      const queryDto: QueryDto = {
        query: '',
      };

      const mockEmptyResult = { users: [] };
      mockSearchService.getMatchingUsers.mockResolvedValueOnce(mockEmptyResult);

      const result = await controller.getTopUsers(mockUser, queryDto);

      expect(mockSearchService.getMatchingUsers).toHaveBeenCalledWith(BigInt(mockUser.id), '');
      expect(result).toEqual(mockEmptyResult);
    });

    it('should convert user id to BigInt', async () => {
      const userWithStringId: RequestUser = {
        id: '123456789',
      };

      const queryDto: QueryDto = {
        query: 'test',
      };

      mockSearchService.getMatchingUsers.mockResolvedValueOnce({ users: [] });

      await controller.getTopUsers(userWithStringId, queryDto);

      expect(mockSearchService.getMatchingUsers).toHaveBeenCalledWith(BigInt('123456789'), 'test');
    });
  });

  describe('searchTweets', () => {
    it('should search tweets with default limit of 20', async () => {
      const searchTweetsQueryDto: SearchTweetsQueryDto = {
        query: 'test search',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchTweets.mockResolvedValueOnce(mockSearchResult);

      const result = await controller.searchTweets(mockUser, searchTweetsQueryDto);

      expect(mockSearchService.searchTweets).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining({
          ...searchTweetsQueryDto,
          excludeMutedAndBlocked: undefined,
        }),
        20,
        undefined,
      );
      expect(result).toEqual(mockSearchResult);
    });

    it('should search tweets with custom limit', async () => {
      const searchTweetsQueryDto: SearchTweetsQueryDto = {
        query: 'test search',
        tab: SearchTab.Latest,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchTweets.mockResolvedValueOnce(mockSearchResult);

      const result = await controller.searchTweets(mockUser, searchTweetsQueryDto, '50');

      expect(mockSearchService.searchTweets).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining({
          ...searchTweetsQueryDto,
          excludeMutedAndBlocked: undefined,
        }),
        50,
        undefined,
      );
      expect(result).toEqual(mockSearchResult);
    });

    it('should call searchTweets with all parameters', async () => {
      const searchTweetsQueryDto: SearchTweetsQueryDto = {
        query: 'example search',
        tab: SearchTab.Media,
        peopleFilter: PeopleSearchFilter.Following,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchTweets.mockResolvedValueOnce(mockSearchResult);

      await controller.searchTweets(mockUser, searchTweetsQueryDto, '30', 'cursor-string', true);

      expect(mockSearchService.searchTweets).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining({
          ...searchTweetsQueryDto,
          excludeMutedAndBlocked: true,
        }),
        30,
        'cursor-string',
      );
    });

    it('should set excludeMutedAndBlocked to false when provided as false', async () => {
      const searchTweetsQueryDto: SearchTweetsQueryDto = {
        query: 'test',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchTweets.mockResolvedValueOnce(mockSearchResult);

      await controller.searchTweets(mockUser, searchTweetsQueryDto, undefined, undefined, false);

      expect(mockSearchService.searchTweets).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining({
          ...searchTweetsQueryDto,
          excludeMutedAndBlocked: false,
        }),
        20,
        undefined,
      );
    });

    it('should handle different search tabs', async () => {
      const tabs = [SearchTab.Top, SearchTab.Latest, SearchTab.Media];

      for (const tab of tabs) {
        const searchTweetsQueryDto: SearchTweetsQueryDto = {
          query: 'test',
          tab,
          peopleFilter: undefined,
          excludeMutedAndBlocked: false,
        };

        mockSearchService.searchTweets.mockResolvedValueOnce(mockSearchResult);

        await controller.searchTweets(mockUser, searchTweetsQueryDto);

        expect(mockSearchService.searchTweets).toHaveBeenCalledWith(
          BigInt(mockUser.id),
          expect.objectContaining({ tab }),
          20,
          undefined,
        );
      }
    });

    it('should handle people filter', async () => {
      const searchTweetsQueryDto: SearchTweetsQueryDto = {
        query: 'test',
        tab: SearchTab.Top,
        peopleFilter: PeopleSearchFilter.Following,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchTweets.mockResolvedValueOnce(mockSearchResult);

      await controller.searchTweets(mockUser, searchTweetsQueryDto);

      expect(mockSearchService.searchTweets).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining({
          peopleFilter: PeopleSearchFilter.Following,
        }),
        20,
        undefined,
      );
    });

    it('should parse string limit to integer', async () => {
      const searchTweetsQueryDto: SearchTweetsQueryDto = {
        query: 'test',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchTweets.mockResolvedValueOnce(mockSearchResult);

      await controller.searchTweets(mockUser, searchTweetsQueryDto, '100');

      expect(mockSearchService.searchTweets).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.anything(),
        100,
        undefined,
      );
    });

    it('should mutate the query DTO with excludeMutedAndBlocked value', async () => {
      const searchTweetsQueryDto: SearchTweetsQueryDto = {
        query: 'test',
        tab: SearchTab.Top,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchTweets.mockResolvedValueOnce(mockSearchResult);

      await controller.searchTweets(mockUser, searchTweetsQueryDto, undefined, undefined, true);

      // The DTO should be mutated
      expect(searchTweetsQueryDto.excludeMutedAndBlocked).toBe(true);
    });
  });

  describe('getTopHashtags', () => {
    it('should call trendingService.getTrendingWords with correct parameters', async () => {
      const queryDto: QueryDto = {
        query: 'javascript',
      };

      const mockTrendingWords = {
        words: ['javascript', 'typescript', 'nodejs'],
      };

      mockTrendingService.getTrendingWords.mockResolvedValueOnce(mockTrendingWords);

      const result = await controller.getTopHashtags(queryDto);

      expect(mockTrendingService.getTrendingWords).toHaveBeenCalledWith('javascript', 3);
      expect(result).toEqual(mockTrendingWords);
    });

    it('should always request 3 trending words', async () => {
      const queryDto: QueryDto = {
        query: 'test',
      };

      mockTrendingService.getTrendingWords.mockResolvedValueOnce({ words: [] });

      await controller.getTopHashtags(queryDto);

      expect(mockTrendingService.getTrendingWords).toHaveBeenCalledWith('test', 3);
    });

    it('should handle empty query', async () => {
      const queryDto: QueryDto = {
        query: '',
      };

      mockTrendingService.getTrendingWords.mockResolvedValueOnce({ words: [] });

      const result = await controller.getTopHashtags(queryDto);

      expect(mockTrendingService.getTrendingWords).toHaveBeenCalledWith('', 3);
      expect(result).toEqual({ words: [] });
    });

    it('should handle hashtag query with # symbol', async () => {
      const queryDto: QueryDto = {
        query: '#javascript',
      };

      mockTrendingService.getTrendingWords.mockResolvedValueOnce({ words: ['javascript'] });

      await controller.getTopHashtags(queryDto);

      expect(mockTrendingService.getTrendingWords).toHaveBeenCalledWith('#javascript', 3);
    });
  });

  describe('searchUsers', () => {
    const mockUserSearchResult = {
      users: [
        {
          id: '10',
          username: 'john_doe',
          displayName: 'John Doe',
          avatarUrl: 'http://avatar.jpg',
          isFollowing: false,
          isFollowedBy: false,
        },
      ],
      pagination: {
        nextCursor: 'user-cursor',
        hasMore: true,
      },
    };

    it('should search users with default limit of 20', async () => {
      const searchUsersQueryDto: SearchUsersQueryDto = {
        query: 'john',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchUsers.mockResolvedValueOnce(mockUserSearchResult);

      const result = await controller.searchUsers(mockUser, searchUsersQueryDto);

      expect(mockSearchService.searchUsers).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining({
          ...searchUsersQueryDto,
          excludeMutedAndBlocked: undefined,
        }),
        20, // default limit
        undefined,
      );
      expect(result).toEqual(mockUserSearchResult);
    });

    it('should search users with custom limit', async () => {
      const searchUsersQueryDto: SearchUsersQueryDto = {
        query: 'jane',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchUsers.mockResolvedValueOnce(mockUserSearchResult);

      const result = await controller.searchUsers(mockUser, searchUsersQueryDto, '50');

      expect(mockSearchService.searchUsers).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining(searchUsersQueryDto),
        50,
        undefined,
      );
      expect(result).toEqual(mockUserSearchResult);
    });

    it('should call searchUsers with all parameters', async () => {
      const searchUsersQueryDto: SearchUsersQueryDto = {
        query: 'test user',
        peopleFilter: PeopleSearchFilter.Following,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchUsers.mockResolvedValueOnce(mockUserSearchResult);

      await controller.searchUsers(
        mockUser,
        searchUsersQueryDto,
        '100',
        'user-cursor-string',
        true,
      );

      expect(mockSearchService.searchUsers).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining({
          ...searchUsersQueryDto,
          excludeMutedAndBlocked: true,
        }),
        100,
        'user-cursor-string',
      );
    });

    it('should handle cursor pagination', async () => {
      const searchUsersQueryDto: SearchUsersQueryDto = {
        query: 'paginated users',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      const cursor = 'base64-user-cursor';

      mockSearchService.searchUsers.mockResolvedValueOnce(mockUserSearchResult);

      await controller.searchUsers(mockUser, searchUsersQueryDto, undefined, cursor);

      expect(mockSearchService.searchUsers).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining(searchUsersQueryDto),
        20, // default limit
        cursor,
      );
    });

    it('should set excludeMutedAndBlocked to true', async () => {
      const searchUsersQueryDto: SearchUsersQueryDto = {
        query: 'test',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchUsers.mockResolvedValueOnce(mockUserSearchResult);

      await controller.searchUsers(mockUser, searchUsersQueryDto, undefined, undefined, true);

      expect(mockSearchService.searchUsers).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining({
          ...searchUsersQueryDto,
          excludeMutedAndBlocked: true,
        }),
        20,
        undefined,
      );
    });

    it('should set excludeMutedAndBlocked to false when provided as false', async () => {
      const searchUsersQueryDto: SearchUsersQueryDto = {
        query: 'test',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchUsers.mockResolvedValueOnce(mockUserSearchResult);

      await controller.searchUsers(mockUser, searchUsersQueryDto, undefined, undefined, false);

      expect(mockSearchService.searchUsers).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining({
          ...searchUsersQueryDto,
          excludeMutedAndBlocked: false,
        }),
        20,
        undefined,
      );
    });

    it('should parse string limit to integer', async () => {
      const searchUsersQueryDto: SearchUsersQueryDto = {
        query: 'test',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchUsers.mockResolvedValueOnce(mockUserSearchResult);

      await controller.searchUsers(mockUser, searchUsersQueryDto, '150');

      expect(mockSearchService.searchUsers).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.anything(),
        150,
        undefined,
      );
    });

    it('should convert user id to BigInt', async () => {
      const userWithStringId: RequestUser = {
        id: '987654321',
      };

      const searchUsersQueryDto: SearchUsersQueryDto = {
        query: 'test',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchUsers.mockResolvedValueOnce(mockUserSearchResult);

      await controller.searchUsers(userWithStringId, searchUsersQueryDto);

      expect(mockSearchService.searchUsers).toHaveBeenCalledWith(
        BigInt('987654321'),
        expect.anything(),
        20,
        undefined,
      );
    });

    it('should handle empty search results', async () => {
      const searchUsersQueryDto: SearchUsersQueryDto = {
        query: 'nonexistent',
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      const emptyResult = {
        users: [],
        pagination: {
          nextCursor: null,
          hasMore: false,
        },
      };

      mockSearchService.searchUsers.mockResolvedValueOnce(emptyResult);

      const result = await controller.searchUsers(mockUser, searchUsersQueryDto);

      expect(result).toEqual(emptyResult);
      expect(result.users).toHaveLength(0);
    });
  });
});
