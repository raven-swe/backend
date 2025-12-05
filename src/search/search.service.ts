import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { SEARCH_ERROR_CODES, SEARCH_ERROR_MESSAGES } from './constants';
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
import { TweetRelationsCursor, UserSearchCursor } from 'src/common/types/cursors';
import { PAGINATION_ERROR_CODES, PAGINATION_ERROR_MESSAGES } from 'src/common/constants';
import { decodeCompositeCursor, paginateComposite } from 'src/common/utils';
import { SearchUsersQueryDto } from './dtos/search-users-query.dto';
import { mapToUserSearchResultDto } from './mappers/user-search-result.mapper';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly tweetsService: TweetsService,
  ) {}

  async getMatchingUsers(userId: bigint, username: string) {
    const users = await this.usersService.getMatchingUsers(userId, username);
    if (!users || users.length === 0) {
      throw new HttpException(
        {
          message: SEARCH_ERROR_MESSAGES.NO_MATCHING_USERS,
          code: SEARCH_ERROR_CODES.NO_MATCHING_USERS,
        },
        HttpStatus.NOT_FOUND,
      );
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

    const rawQuery = decodeURIComponent(query);

    if (!rawQuery || rawQuery.trim() === '') {
      throw new HttpException(
        {
          message: SEARCH_ERROR_MESSAGES.EMPTY_SEARCH_QUERY,
          code: SEARCH_ERROR_CODES.EMPTY_SEARCH_QUERY,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const isHashtagSearch = isSingleHashtagQuery(rawQuery);
    const cleanedQuery = isHashtagSearch ? extractHashtag(rawQuery) : prepareSearchQuery(rawQuery);
    const decodedCursor = this.decodeCursor(prevCursor);

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

    const pagination = paginateComposite(items, limit, prevCursor, (tweet) => {
      return {
        createdAt: tweet.createdAt,
        id: tweet.id.toString(),
      };
    });

    this.logger.log(`Fetched ${items.length} top tweets for query: ${query}`);

    return { items, pagination };
  }

  private decodeCursor(prevCursor?: string): TweetRelationsCursor | undefined {
    if (!prevCursor) return undefined;

    try {
      return decodeCompositeCursor<TweetRelationsCursor>(prevCursor);
    } catch {
      throw new HttpException(
        {
          message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
          code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async fetchTweetsByTab(
    tab: SearchTab | undefined,
    isHashtagSearch: boolean,
    cleanedQuery: string,
    currentUserId: bigint,
    limit: number,
    decodedCursor: TweetRelationsCursor | undefined,
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
        decodedCursor,
        excludeMutedAndBlocked,
        peopleFilter,
      );
    }

    return withMedia
      ? this.tweetsService.getTweetsWithMediaByQuery(
          currentUserId,
          cleanedQuery,
          limit,
          decodedCursor,
          excludeMutedAndBlocked,
          peopleFilter,
        )
      : this.tweetsService.getTopTweetsByQuery(
          currentUserId,
          cleanedQuery,
          limit,
          decodedCursor,
          excludeMutedAndBlocked,
          peopleFilter,
        );
  }

  async searchUsers(
    currentUserId: bigint,
    searchUsersQueryDto: SearchUsersQueryDto,
    limit: number,
    prevCursor?: string,
  ) {
    const { query, peopleFilter, excludeMutedAndBlocked } = searchUsersQueryDto;

    const rawQuery = decodeURIComponent(query);

    if (!rawQuery || rawQuery.trim() === '') {
      throw new HttpException(
        {
          message: SEARCH_ERROR_MESSAGES.EMPTY_SEARCH_QUERY,
          code: SEARCH_ERROR_CODES.EMPTY_SEARCH_QUERY,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const cleanedQuery = prepareSearchQuery(rawQuery);
    console.log({ cleanedQuery });
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

    // Get users relationships
    const userIds = items.map((user) => BigInt(user.id));
    const relationships = await this.usersService.getUsersRelationshipsMap(currentUserId, userIds);

    const mappedUsers = mapToUserSearchResultDto(items);

    // Attach relationships
    for (const user of items) {
      const relationship = relationships.get(BigInt(user.id));
      if (relationship) {
        mappedUsers[items.findIndex((u) => u.id === user.id)].relationship = relationship;
      }
    }

    const pagination = paginateComposite(items, limit, prevCursor, (user) => {
      console.log({ user });
      return {
        createdAt: user.createdAt,
        id: user.id.toString(),
        simScore: user.simScore,
      };
    });

    this.logger.log(`Fetched ${items.length} top users for query: ${query}`);
    return { mappedUsers, pagination };
  }
}
