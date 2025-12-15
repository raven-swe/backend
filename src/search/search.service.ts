import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import {
  PeopleSearchFilter,
  SearchTab,
  SearchTweetsQueryDto,
} from './dtos/search-tweets-query.dto';
import { GetTweetResponseDto } from 'src/tweets/dtos';
import { TweetsService } from 'src/tweets/tweets.service';
import {
  extractHashtag,
  isSingleHashtagQuery,
  prepareSearchQuery,
} from './utils/search-query.util';
import {
  isTweetRankCursor,
  isTweetRelationsCursor,
  TweetRankCursor,
  TweetRelationsCursor,
  UserSearchCursor,
} from 'src/common/types/cursors';
import { SearchUsersQueryDto } from './dtos/search-users-query.dto';
import { mapToUserSearchResultDto } from './mappers/user-search-result.mapper';
import { PAGINATION_ERROR_CODES, PAGINATION_ERROR_MESSAGES } from 'src/common/constants';
import { decodeCompositeCursor, paginateComposite } from 'src/common/utils';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly tweetsService: TweetsService,
  ) {}
  async getMatchingUsers(userId: bigint, username: string) {
    if (!username || username.trim() === '') {
      return { users: [] };
    }

    const users = await this.usersService.getMatchingUsers(userId, username);
    if (!users || users.length === 0) {
      return { users: [] };
    }

    const userIds = users.map((u) => u.id);
    const followRelations = await this.usersService.getUserFollowRelations(userId, userIds);

    const followingSet = new Set<bigint>();
    const followerSet = new Set<bigint>();

    for (const relation of followRelations) {
      if (relation.followerId === userId) {
        followingSet.add(relation.followedId);
      }
      if (relation.followedId === userId) {
        followerSet.add(relation.followerId);
      }
    }

    const usersData = users.map((user) => ({
      username: user.username,
      displayName: user.profile?.displayName || '',
      avatarUrl: user.profile?.avatarUrl,
      isFollowing: followingSet.has(user.id),
      isFollower: followerSet.has(user.id),
    }));

    return { users: usersData };
  }

  async searchTweets(
    currentUserId: bigint,
    searchTweetsQueryDto: SearchTweetsQueryDto,
    limit: number,
    prevCursor?: string,
  ) {
    const { query, tab, peopleFilter, excludeMutedAndBlocked } = searchTweetsQueryDto;

    let rawQuery: string;
    try {
      rawQuery = decodeURIComponent(query);
    } catch {
      // If decoding fails, use the original query
      rawQuery = query;
    }

    if (!rawQuery || rawQuery.trim() === '') {
      return {
        items: [],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };
    }

    const isRelevanceSearch = !tab || tab === SearchTab.Top || tab == SearchTab.Media;
    const isHashtagSearch = isSingleHashtagQuery(rawQuery);
    const cleanedQuery = isHashtagSearch ? extractHashtag(rawQuery) : prepareSearchQuery(rawQuery);
    const decodedCursor = this.decodeCursor(prevCursor, isRelevanceSearch);

    const items = await this.fetchTweetsByTab(
      tab,
      isHashtagSearch,
      cleanedQuery,
      currentUserId,
      limit,
      decodedCursor,
      excludeMutedAndBlocked,
      peopleFilter,
    );

    // Create cursor with correct field based on search type
    const pagination = isRelevanceSearch
      ? paginateComposite(items, limit, prevCursor, (tweet) => {
          return {
            type: 'rank',
            rank: tweet.rank?.toString(),
            id: tweet.id.toString(),
          } as TweetRankCursor;
        })
      : paginateComposite(items, limit, prevCursor, (tweet) => {
          return {
            type: 'relations',
            createdAt: tweet.createdAt,
            id: tweet.id.toString(),
          } as TweetRelationsCursor;
        });

    this.logger.log(`Fetched ${items.length} top tweets for query: ${query}`);

    return { items, pagination };
  }

  /**
   * Decodes cursor and validates it matches the expected search type
   * Throws error if cursor is invalid or wrong type for search mode
   */
  private decodeCursor(
    prevCursor?: string,
    isRelevanceSearch: boolean = true,
  ): TweetRankCursor | TweetRelationsCursor | undefined {
    if (!prevCursor) return undefined;

    let decoded: TweetRankCursor | TweetRelationsCursor | undefined;

    try {
      decoded = decodeCompositeCursor<TweetRankCursor | TweetRelationsCursor>(prevCursor);
    } catch {
      throw new HttpException(
        {
          message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
          code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate cursor type matches search mode
    if (isRelevanceSearch && !isTweetRankCursor(decoded)) {
      throw new HttpException(
        {
          message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
          code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!isRelevanceSearch && !isTweetRelationsCursor(decoded)) {
      throw new HttpException(
        {
          message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
          code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return decoded;
  }

  private async fetchTweetsByTab(
    tab: SearchTab | undefined,
    isHashtagSearch: boolean,
    cleanedQuery: string,
    currentUserId: bigint,
    limit: number,
    decodedCursor: TweetRelationsCursor | TweetRankCursor | undefined,
    excludeMutedAndBlocked: boolean = false,
    peopleFilter?: PeopleSearchFilter,
  ): Promise<GetTweetResponseDto[]> {
    const withMedia = tab === SearchTab.Media;

    if (isHashtagSearch) {
      return this.tweetsService.getTweetsByHashtag(
        cleanedQuery,
        currentUserId,
        limit,
        withMedia,
        decodedCursor as TweetRelationsCursor | undefined,
        excludeMutedAndBlocked,
        peopleFilter,
      );
    }

    if (tab === SearchTab.Latest) {
      return this.tweetsService.getLatestTweetsByQuery(
        currentUserId,
        cleanedQuery,
        limit,
        decodedCursor as TweetRelationsCursor | undefined,
        excludeMutedAndBlocked,
        peopleFilter,
      );
    } else if (tab === SearchTab.Media) {
      return this.tweetsService.getTweetsWithMediaByQuery(
        currentUserId,
        cleanedQuery,
        limit,
        decodedCursor as TweetRankCursor | undefined,
        excludeMutedAndBlocked,
        peopleFilter,
      );
    } else {
      return this.tweetsService.getTopTweetsByQuery(
        currentUserId,
        cleanedQuery,
        limit,
        decodedCursor as TweetRankCursor | undefined,
        excludeMutedAndBlocked,
        peopleFilter,
      );
    }
  }

  async searchUsers(
    currentUserId: bigint,
    searchUsersQueryDto: SearchUsersQueryDto,
    limit: number = 20,
    prevCursor?: string,
  ) {
    const { query, peopleFilter, excludeMutedAndBlocked } = searchUsersQueryDto;

    let rawQuery: string;
    try {
      rawQuery = decodeURIComponent(query);
    } catch {
      // If decoding fails, use the original query
      rawQuery = query;
    }

    if (!rawQuery || rawQuery.trim() === '') {
      return {
        items: [],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };
    }

    const cleanedQuery = rawQuery.toLowerCase().trim();
    let decodedCursor: UserSearchCursor | undefined;
    try {
      decodedCursor = prevCursor ? decodeCompositeCursor<UserSearchCursor>(prevCursor) : undefined;
    } catch {
      throw new HttpException(
        {
          message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
          code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const items = await this.usersService.searchUsers(
      currentUserId,
      cleanedQuery,
      limit + 1,
      decodedCursor,
      excludeMutedAndBlocked,
      peopleFilter,
    );

    const pagination = paginateComposite(items, limit, prevCursor, (user) => {
      return {
        rankingScore: BigInt(user.rankingScore),
        id: user.id.toString(),
      };
    });

    // Get users relationships
    const userIds = items.map((user) => BigInt(user.id));
    const relationships = await this.usersService.getUsersRelationshipsMap(currentUserId, userIds);

    // Map items with relationships
    const mappedUsers = mapToUserSearchResultDto(
      items.map((user) => ({
        ...user,
        relationship: relationships.get(BigInt(user.id)),
      })),
    );

    this.logger.log(`Fetched ${items.length} top users for query: ${query}`);
    return { users: mappedUsers, pagination };
  }
}
