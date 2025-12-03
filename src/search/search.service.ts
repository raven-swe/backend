import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { SEARCH_ERROR_CODES, SEARCH_ERROR_MESSAGES } from './constants';
import { SearchTab, SearchTweetsQueryDto } from './dtos/search-tweets-query.dto';
import { TweetDto } from 'src/tweets/dtos';
import { TweetsService } from 'src/tweets/tweets.service';
import { prepareSearchQuery } from './utils/search-query.util';

@Injectable()
export class SearchService {
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
    cursor?: string,
  ) {
    const { query, tab } = searchTweetsQueryDto;

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
    if (!cleanedQuery) {
      throw new HttpException(
        {
          message: SEARCH_ERROR_MESSAGES.INVALID_SEARCH_QUERY,
          code: SEARCH_ERROR_CODES.INVALID_SEARCH_QUERY,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    let tweets: TweetDto[] = [];
    let pagination;
    switch (tab) {
      case SearchTab.Top:
        ({ items: tweets, pagination } = await this.tweetsService.getTopTweetsByQuery(
          currentUserId,
          cleanedQuery,
          limit,
          cursor,
        ));
        break;
      case SearchTab.Latest:
        tweets = await this.searchTweetsLatest(currentUserId, cleanedQuery, limit, cursor);
        break;
      case SearchTab.Media:
        tweets = await this.searchTweetsMedia(currentUserId, cleanedQuery, limit, cursor);
        break;
      default:
        ({ items: tweets, pagination } = await this.tweetsService.getTopTweetsByQuery(
          currentUserId,
          cleanedQuery,
          limit,
          cursor,
        ));
    }

    return { tweets, pagination };
  }

  // async searchTweetsTop(currentUserId: bigint, query: string, limit?: string, cursor?: string) {
  //   // Implement the logic to search top tweets based on the query
  //   // Please don't forget to remove tweets of blocked users
  //   return [];
  // }

  async searchTweetsLatest(currentUserId: bigint, query: string, limit?: number, cursor?: string) {
    // Implement the logic to search latest tweets based on the query
    // Please don't forget to remove tweets of blocked users
    return [];
  }

  async searchTweetsMedia(currentUserId: bigint, query: string, limit?: number, cursor?: string) {
    // Implement the logic to search media tweets based on the query
    // Please don't forget to remove tweets of blocked users
    return [];
  }
}
