import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { SEARCH_ERROR_CODES, SEARCH_ERROR_MESSAGES } from './constants';

@Injectable()
export class SearchService {
  constructor(private readonly usersService: UsersService) {}

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
}
