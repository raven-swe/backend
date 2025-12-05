import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from 'src/search/search.controller';
import { SearchService } from 'src/search/search.service';
import { PeopleSearchFilter, SearchTab, SearchTweetsQueryDto } from 'src/search/dtos';
import { ParseBooleanPipe } from 'src/common/pipes/parse-boolean.pipe';
import { RequestUser } from 'src/common/interfaces';

describe('SearchController - searchTweets', () => {
  let controller: SearchController;

  const mockSearchService = {
    searchTweets: jest.fn(),
    getMatchingUsers: jest.fn(),
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
      providers: [{ provide: SearchService, useValue: mockSearchService }, ParseBooleanPipe],
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

  describe('searchTweets', () => {
    it('should search tweets with default limit of 20', async () => {
      const searchTweetsQueryDto = {
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
      const searchTweetsQueryDto = {
        query: 'test search',
        tab: SearchTab.Latest,
        peopleFilter: undefined,
        excludeMutedAndBlocked: false,
      };

      mockSearchService.searchTweets.mockResolvedValueOnce(mockSearchResult);

      const result = await controller.searchTweets(mockUser, searchTweetsQueryDto, '50');

      expect(mockSearchService.searchTweets).toHaveBeenCalledWith(
        BigInt(mockUser.id),
        expect.objectContaining(searchTweetsQueryDto),
        50,
        undefined,
      );

      expect(result).toEqual(mockSearchResult);
    });

    it('should call searchTweets with correct parameters', async () => {
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
  });
});
