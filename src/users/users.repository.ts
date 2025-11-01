import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { NewUser } from './interfaces/NewUser.interface';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants/users.constants';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UserProfileResponseDto, UserRelationshipDto } from './dtos/user-profile-response.dto';
import { DEFAULT_PROFILE_PICTURE } from './constants/users';
import { FollowsCursor } from 'src/common/utils/cursor-pagination.util';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return await this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: bigint) {
    return await this.prisma.user.findUnique({ where: { id } });
  }

  async findByIdentifier(identifier: string) {
    return await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });
  }

  async createUser(newUser: NewUser, prismaClient: Prisma.TransactionClient = this.prisma) {
    const { email, passwordHash, username, languageCode, birthDate } = newUser;
    return await prismaClient.user.create({
      data: {
        email,
        username: username,
        passwordHash: passwordHash,
        languageCode: languageCode,
        birthdate: birthDate,
      },
    });
  }

  async updatePasswordById(userId: bigint, hashedPassword: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });
  }

  async updateProfile(userId: bigint, data: UpdateProfileDto) {
    return await this.prisma.$transaction(async (tx) => {
      let birthDate: string | undefined = undefined;

      // Update birthDate in users table if provided
      if (data.birthDate !== undefined) {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { birthdate: data.birthDate },
        });
        birthDate = updatedUser.birthdate?.toISOString().split('T')[0];
      }

      // Build prismaData conditionally
      const prismaData: Prisma.ProfileUpdateInput = {};
      if (data.displayName !== undefined) prismaData.displayName = data.displayName;
      if (data.bio !== undefined) prismaData.bio = data.bio;
      if (data.location !== undefined) prismaData.location = data.location;
      if (data.websiteUrl !== undefined) prismaData.websiteUrl = data.websiteUrl;
      if (data.avatarUrl !== undefined) prismaData.avatarUrl = data.avatarUrl;
      if (data.bannerUrl !== undefined) prismaData.bannerUrl = data.bannerUrl;

      // Only update if there are fields to update
      let profile;
      if (Object.keys(prismaData).length > 0) {
        profile = await tx.profile.update({
          where: { userId: userId },
          data: prismaData,
        });
      } else {
        // If no profile fields to update, just fetch the existing profile
        profile = await tx.profile.findUnique({
          where: { userId: userId },
        });
      }

      if (!profile) {
        throw new Error(`Profile not found for user ${userId}`);
      }

      // Map profile fields to return
      return {
        displayName: profile.displayName,
        bio: profile.bio,
        bioEntities: profile.bioEntities,
        location: profile.location,
        birthDate,
        websiteUrl: profile.websiteUrl,
        avatarUrl: profile.avatarUrl || DEFAULT_PROFILE_PICTURE,
        bannerUrl: profile.bannerUrl,
        updatedAt: profile.updatedAt,
      };
    });
  }

  async findUserProfileByUsername(
    username: string,
    currentUserId?: bigint,
    isMyProfile: boolean = false,
  ): Promise<UserProfileResponseDto | null> {
    // Build the where clause based on whether it's the user's own profile
    const whereClause = isMyProfile && currentUserId ? { id: currentUserId } : { username };

    const user = await this.prisma.user.findUnique({
      where: whereClause,
      include: {
        profile: true,
        _count: {
          select: {
            following: true,
            followers: true,
          },
        },
      },
    });

    // TODO: change is_deleted to deleted_at after migrating the database
    if (!user || user.deletedAt) return null;

    // Get relationship if currentUserId is provided
    let relationship: UserRelationshipDto | null = null;

    // TODO: convert to "let" after implementing mutual followers
    const mutualsCount: number | null = 2;
    const mutualNames: string[] | null = ['Omar', 'Tasneem'];

    // Get relationship status only if currentUserId is provided and is different from the profile user
    if (currentUserId && !isMyProfile) {
      // Check if current user is following this user
      const isFollowing = await this.prisma.follow.findUnique({
        where: {
          followerId_followedId: {
            followerId: currentUserId,
            followedId: user.id,
          },
        },
      });

      // Check if this user is following current user
      const isFollower = await this.prisma.follow.findUnique({
        where: {
          followerId_followedId: {
            followerId: user.id,
            followedId: currentUserId,
          },
        },
      });

      // Check if current user is blocking this user
      const isBlocking = await this.prisma.block.findUnique({
        where: {
          userId_blockedId: {
            userId: currentUserId,
            blockedId: user.id,
          },
        },
      });

      // Check if the user is blocking current user
      const isBlockedBy = await this.prisma.block.findUnique({
        where: {
          userId_blockedId: {
            userId: user.id,
            blockedId: currentUserId,
          },
        },
      });

      // Check if the current user has muted this user
      const isMuted = await this.prisma.mute.findUnique({
        where: {
          userId_mutedId: {
            userId: currentUserId,
            mutedId: user.id,
          },
        },
      });

      relationship = {
        blocking: !!isBlocking,
        blockedBy: !!isBlockedBy,
        following: !!isFollowing,
        follower: !!isFollower,
        muted: !!isMuted,
      };

      // TODO: Get mutual followers count and names
    }

    return {
      username: user.username,
      // TODO: profile should be created automatically on user creation
      displayName: user.profile?.displayName || '',
      bio: user.profile?.bio || null,
      // TODO: return actual bio entities after implementing rich text bios
      bioEntities: null,
      location: user.profile?.location || null,
      birthDate: user.birthdate.toISOString().split('T')[0] || null,
      avatarUrl: user.profile?.avatarUrl || DEFAULT_PROFILE_PICTURE,
      bannerUrl: user.profile?.bannerUrl || null,
      websiteUrl: user.profile?.websiteUrl || null,
      joinedAt: user.createdAt,
      relationship,
      followingCount: user._count.following,
      followersCount: user._count.followers,

      mutualsCount: mutualsCount ? mutualsCount : null,
      mutualNames,
    };
  }

  async updateUsernameById(userId: bigint, newUsername: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    if (user.username === newUsername) {
      return;
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        username: {
          equals: newUsername,
          mode: 'insensitive',
        },
      },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USERNAME_ALREADY_USED,
          code: USERS_ERROR_CODES.USERNAME_ALREADY_USED,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { username: newUsername },
    });
  }

  async checkUsernameExistence(id: string, username: string) {
    const userId = BigInt(id);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    if (user.username === username) {
      return null;
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
      },
    });

    return existingUser && existingUser.id !== userId ? existingUser : null;
  }

  async updateUserEmail(
    userId: bigint,
    emailUpdateData: {
      userId: string;
      otp: string;
      newEmail: string;
      verified: boolean;
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.userExternalAccount.deleteMany({ where: { userId } });

      await tx.user.update({
        where: { id: userId },
        data: {
          email: emailUpdateData.newEmail,
        },
      });
    });
  }

  async getUserFollowings(
    requestedUserId: bigint,
    limit: number,
    prevCursor: FollowsCursor | undefined,
  ) {
    return await this.prisma.follow.findMany({
      where: { followerId: requestedUserId },
      take: limit,
      cursor: prevCursor
        ? {
            followerId_followedId: {
              followerId: BigInt(prevCursor.followerId),
              followedId: BigInt(prevCursor.followedId),
            },
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { followerId: 'asc' }, { followedId: 'asc' }],
      include: {
        followedUser: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                bio: true,
                avatarUrl: true,
                bioEntities: true,
              },
            },
          },
        },
      },
    });
  }
  async followUser(followerId: bigint, followedId: bigint) {
    await this.prisma.follow.create({
      data: {
        followerId,
        followedId,
      },
    });
  }

  async unfollowUser(followerId: bigint, followedId: bigint) {
    await this.prisma.follow.delete({
      where: {
        followerId_followedId: {
          followerId,
          followedId,
        },
      },
    });
  }

  async getFollowBacksForFollowings(requestedUserId: bigint, followingIds: bigint[]) {
    return await this.prisma.follow.findMany({
      where: {
        followedId: requestedUserId,
        followerId: { in: followingIds },
      },
      select: { followerId: true },
    });
  }

  async getUserFollowers(
    requestedUserId: bigint,
    limit: number,
    prevCursor: FollowsCursor | undefined,
  ) {
    return await this.prisma.follow.findMany({
      where: { followedId: requestedUserId },
      take: limit,
      cursor: prevCursor
        ? {
            followerId_followedId: {
              followerId: BigInt(prevCursor.followerId),
              followedId: BigInt(prevCursor.followedId),
            },
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { followerId: 'asc' }, { followedId: 'asc' }],
      include: {
        followerUser: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                bio: true,
                avatarUrl: true,
                bioEntities: true,
              },
            },
          },
        },
      },
    });
  }
  async isFollowing(followerId: bigint, followedId: bigint) {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followedId: {
          followerId,
          followedId,
        },
      },
    });
    return !!follow;
  }

  /**
   * Blocks a user and removes any existing follow relationships between the users.
   */
  async blockUser(userId: bigint, blockedId: bigint) {
    await this.prisma.$transaction(async (tx) => {
      await tx.block.create({
        data: {
          userId,
          blockedId,
        },
      });

      // Remove follow relationships in both directions
      await tx.follow.deleteMany({
        where: {
          OR: [
            { followerId: userId, followedId: blockedId },
            { followerId: blockedId, followedId: userId },
          ],
        },
      });

      // Remove mute relationships in both directions
      await tx.mute.deleteMany({
        where: {
          OR: [
            { userId: userId, mutedId: blockedId },
            { userId: blockedId, mutedId: userId },
          ],
        },
      });
    });
  }

  async unblockUser(userId: bigint, blockedId: bigint) {
    await this.prisma.block.delete({
      where: {
        userId_blockedId: {
          userId,
          blockedId,
        },
      },
    });
  }
  async getFollowBacksForFollowers(requestedUserId: bigint, followerIds: bigint[]) {
    return await this.prisma.follow.findMany({
      where: {
        followerId: requestedUserId,
        followedId: { in: followerIds },
      },
      select: { followedId: true },
    });
  }

  async getMutualRelations(authUserId: bigint, userIds: bigint[]) {
    return await this.prisma.follow.findMany({
      where: {
        OR: [
          { followerId: authUserId, followedId: { in: userIds } },
          { followerId: { in: userIds }, followedId: authUserId },
        ],
      },
      select: { followerId: true, followedId: true },
    });
  }

  async isBlocked(userId: bigint, blockedId: bigint) {
    const block = await this.prisma.block.findUnique({
      where: {
        userId_blockedId: {
          userId,
          blockedId,
        },
      },
    });
    return !!block;
  }

  async muteUser(userId: bigint, mutedId: bigint) {
    await this.prisma.mute.create({
      data: {
        userId,
        mutedId,
      },
    });
  }

  async unmuteUser(userId: bigint, mutedId: bigint) {
    await this.prisma.mute.delete({
      where: {
        userId_mutedId: {
          userId,
          mutedId,
        },
      },
    });
  }

  async isMuted(userId: bigint, mutedId: bigint) {
    const mute = await this.prisma.mute.findUnique({
      where: {
        userId_mutedId: {
          userId,
          mutedId,
        },
      },
    });
    return !!mute || (await this.isBlocked(userId, mutedId));
  }
}
