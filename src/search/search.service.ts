import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { SEARCH_ERROR_CODES, SEARCH_ERROR_MESSAGES } from './constants';
import { SearchTab, SearchTweetsQueryDto } from './dtos/search-tweets-query.dto';
import { GetTweetResponseDto } from 'src/tweets/dtos';
import { TweetsService } from 'src/tweets/tweets.service';
import { prepareSearchQuery } from './utils/search-query.util';
import { TweetRelationsCursor } from 'src/common/types/cursors';
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

    if (!query || query.trim() === '') {
      throw new HttpException(
        {
          message: SEARCH_ERROR_MESSAGES.EMPTY_SEARCH_QUERY,
          code: SEARCH_ERROR_CODES.EMPTY_SEARCH_QUERY,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const cleanedQuery = prepareSearchQuery(query);

    let decodedCursor: TweetRelationsCursor | undefined;
    if (prevCursor) {
      try {
        decodedCursor = decodeCompositeCursor<TweetRelationsCursor>(prevCursor);
      } catch {
        throw new HttpException(
          {
            message: PAGINATION_ERROR_CODES.INVALID_CURSOR,
            code: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    let items: GetTweetResponseDto[] = [];
    switch (tab) {
      case SearchTab.Top:
        items = await this.tweetsService.getTopTweetsByQuery(
          currentUserId,
          cleanedQuery,
          limit,
          decodedCursor,
          excludeMutedAndBlocked,
          peopleFilter,
        );
        break;
      case SearchTab.Latest:
        items = await this.tweetsService.getTopTweetsByQuery(
          currentUserId,
          cleanedQuery,
          limit,
          decodedCursor,
          excludeMutedAndBlocked,
          peopleFilter,
        );
        break;
      case SearchTab.Media:
        items = await this.tweetsService.getTweetsWithMediaByQuery(
          currentUserId,
          cleanedQuery,
          limit,
          decodedCursor,
          excludeMutedAndBlocked,
          peopleFilter,
        );
        break;
      default:
        items = await this.tweetsService.getTopTweetsByQuery(
          currentUserId,
          cleanedQuery,
          limit,
          decodedCursor,
          excludeMutedAndBlocked,
          peopleFilter,
        );
    }

    const pagination = paginateComposite(items, limit, prevCursor, (tweet) => {
      return {
        createdAt: tweet.createdAt,
        id: tweet.id.toString(),
      };
    });

    this.logger.log(`Fetched ${items.length} top tweets for query: ${query}`);

    return { items, pagination };
  }
}
