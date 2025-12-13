import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { NewUser } from './interfaces';
import {
  USER_SEARCH_RANKING_WEIGHTS,
  USERS_ERROR_CODES,
  USERS_ERROR_MESSAGES,
} from 'src/users/constants';

import {
  BioEntitiesDto,
  MutualUserDto,
  UpdateProfileDto,
  UserProfileResponseDto,
  UserRelationshipDto,
} from './dtos';
import * as bcrypt from 'bcrypt';
import { PlainMention } from 'src/tweets/interfaces';
import { createValidationError } from 'src/common/utils';
import { BlocksCursor, FollowsCursor, MutesCursor } from 'src/common/interfaces';
import { PeopleSearchFilter } from 'src/search/dtos';
import { RankedUser } from './interfaces/ranked-user.interface';
import { CompactAuthorDto } from 'src/tweets/dtos';
import { plainToClass } from 'class-transformer';
import { RefreshTokensService } from 'src/refresh-tokens/refresh-tokens.service';
import { UserSearchCursor } from 'src/common/types/cursors';

@Injectable()
export class UsersRepository {
  private readonly logger = new Logger(UsersRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

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

  async findByIdentifierWithPhone(identifier: string) {
    return await this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }, { phone: identifier }],
      },
    });
  }

  async findByIdWithProfile(id: bigint) {
    return await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  async findTakenUsernames(candidates: string[]): Promise<Set<string>> {
    const taken = await this.prisma.user.findMany({
      where: { username: { in: candidates } },
      select: { username: true },
    });
    return new Set(taken.map((r) => r.username));
  }

  async getUserEmailAndDisplayName(userId: bigint) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        profile: {
          select: {
            displayName: true,
          },
        },
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

  async updateProfile(
    userId: bigint,
    data: UpdateProfileDto,
    avatarUrl?: string | null,
    bannerUrl?: string | null,
    bioEntities?: BioEntitiesDto | null,
    prismaClient: Prisma.TransactionClient = this.prisma,
  ) {
    let birthDate: string | undefined = undefined;

    // Update birthDate in users table if provided
    if (data.birthDate !== undefined) {
      const updatedUser = await prismaClient.user.update({
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
    if (avatarUrl !== undefined) prismaData.avatarUrl = avatarUrl;
    if (bannerUrl !== undefined) prismaData.bannerUrl = bannerUrl;
    if (bioEntities !== undefined)
      prismaData.bioEntities = bioEntities as unknown as Prisma.InputJsonValue;

    // Only update if there are fields to update
    let profile;
    if (Object.keys(prismaData).length > 0) {
      profile = await prismaClient.profile.update({
        where: { userId: userId },
        data: prismaData,
      });
    } else {
      // If no profile fields to update, just fetch the existing profile
      profile = await prismaClient.profile.findUnique({
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
      avatarUrl: profile.avatarUrl,
      bannerUrl: profile.bannerUrl,
      updatedAt: profile.updatedAt,
    };
  }

  private async fetchUserWithCounts(
    username: string,
    currentUserId: bigint | undefined,
    isMyProfile: boolean,
  ) {
    const whereClause = isMyProfile && currentUserId ? { id: currentUserId } : { username };

    return await this.prisma.user.findUnique({
      where: whereClause,
      include: {
        profile: true,
      },
    });
  }

  private async getProfileMutualFollowersNames(currentUserId: bigint, targetUserId: bigint) {
    // Get the list of users that currentUser follows
    const authFollowedIds = await this.getUserIdsFollowedBy(currentUserId);

    // Get mutual followers
    const mutualFollows = await this.getUserMutualFollowers(
      targetUserId,
      authFollowedIds,
      3,
      undefined,
    );

    // Get total count
    const mutualsCount = await this.prisma.follow.count({
      where: {
        followedId: targetUserId,
        followerId: { in: authFollowedIds },
      },
    });

    const mutualUsers = mutualFollows.map((mutual) => ({
      displayName: mutual.followerUser.profile?.displayName || '',
      avatarUrl: mutual.followerUser.profile?.avatarUrl,
    }));

    return { mutualsCount, mutualUsers };
  }
  async findUserProfileByUsername(
    username: string,
    currentUserId?: bigint,
    isMyProfile: boolean = false,
  ): Promise<UserProfileResponseDto | null> {
    const user = await this.fetchUserWithCounts(username, currentUserId, isMyProfile);
    if (!user || user.deletedAt) return null;

    let mutualsCount: number | null = null;
    let mutualUsers: MutualUserDto[] | null = null;

    // Get relationship status only if currentUserId is provided and is not my profile
    let [isBlocking, isBlockedBy] = [false, false];
    let [isFollowing, isFollower, isMuted] = [false, false, false];

    if (currentUserId && !isMyProfile) {
      // Check blocking status first
      const [blocking, blockedBy] = await Promise.all([
        this.isBlocked(currentUserId, user.id),
        this.isBlocked(user.id, currentUserId),
      ]);
      isBlocking = blocking;
      isBlockedBy = blockedBy;

      if (!isBlocking && !isBlockedBy) {
        // Check following and mute status in parallel if not blocking or blocked by
        const [following, follower, muted] = await Promise.all([
          this.isFollowing(currentUserId, user.id),
          this.isFollowing(user.id, currentUserId),
          this.isMuted(currentUserId, user.id),
        ]);
        [isFollowing, isFollower, isMuted] = [following, follower, muted];
      }

      // Mutuals variables
      ({ mutualsCount, mutualUsers } = await this.getProfileMutualFollowersNames(
        currentUserId,
        user.id,
      ));
    }

    // If current user is blocking the user, return limited profile info
    if (isBlocking) {
      return {
        username: user.username,
        displayName: user.profile?.displayName || '',
        bio: null,
        bioEntities: plainToClass(BioEntitiesDto, user.profile?.bioEntities) || null,
        location: null,
        birthDate: null,
        avatarUrl: user.profile?.avatarUrl,
        bannerUrl: user.profile?.bannerUrl || null,
        websiteUrl: null,
        // TODO: This should be null here but I'm not changing spec now
        joinedAt: user.createdAt,
        relationship: {
          blocking: true,
          blockedBy: !!isBlockedBy,
          following: false,
          follower: false,
          muted: false,
        },
        followingCount: user.followingCount,
        followersCount: user.followersCount,
        mutualsCount: null,
        mutualUsers: null,
      };

      // TODO: Get mutual followers count and names
    }

    const relationship: UserRelationshipDto | null = isMyProfile
      ? null
      : {
          blocking: isBlocking,
          blockedBy: isBlockedBy,
          following: isFollowing,
          follower: isFollower,
          muted: isMuted,
        };

    return {
      username: user.username,
      displayName: user.profile?.displayName || '',
      bio: user.profile?.bio || null,
      bioEntities: plainToClass(BioEntitiesDto, user.profile?.bioEntities) || null,
      location: user.profile?.location || null,
      birthDate: user.birthdate?.toISOString().split('T')[0] || null,
      avatarUrl: user.profile?.avatarUrl,
      bannerUrl: user.profile?.bannerUrl || null,
      websiteUrl: user.profile?.websiteUrl || null,
      joinedAt: user.createdAt,
      relationship,
      followingCount: user.followingCount,
      followersCount: user.followersCount,
      mutualsCount: mutualsCount,
      mutualUsers: mutualUsers,
      email: isMyProfile ? user.email : undefined,
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
        HttpStatus.FORBIDDEN,
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

  async getUserByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username: username },
      select: {
        id: true,
      },
    });
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
    await this.prisma
      .$transaction([
        this.prisma.follow.create({
          data: { followerId, followedId },
        }),
        this.prisma.user.update({
          where: { id: followerId },
          data: { followingCount: { increment: 1 } },
        }),
        this.prisma.user.update({
          where: { id: followedId },
          data: { followersCount: { increment: 1 } },
        }),
      ])
      .catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new HttpException(
            {
              message: USERS_ERROR_MESSAGES.ALREADY_FOLLOWING,
              code: USERS_ERROR_CODES.ALREADY_FOLLOWING,
            },
            HttpStatus.CONFLICT,
          );
        } else {
          throw e;
        }
      });
  }

  async unfollowUser(followerId: bigint, followedId: bigint) {
    await this.prisma
      .$transaction([
        this.prisma.follow.delete({
          where: { followerId_followedId: { followerId, followedId } },
        }),
        this.prisma.user.update({
          where: { id: followerId },
          data: { followingCount: { decrement: 1 } },
        }),
        this.prisma.user.update({
          where: { id: followedId },
          data: { followersCount: { decrement: 1 } },
        }),
        this.prisma.notification.deleteMany({
          where: { receiverId: followedId, actorId: followerId, type: 'FOLLOW' },
        }),
      ])
      .catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          throw new HttpException(
            {
              message: USERS_ERROR_MESSAGES.ALREADY_NOT_FOLLOWING,
              code: USERS_ERROR_CODES.ALREADY_NOT_FOLLOWING,
            },
            HttpStatus.CONFLICT,
          );
        } else {
          throw e;
        }
      });
  }
  async getUserIdsFollowedBy(userId: bigint): Promise<bigint[]> {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followedId: true },
    });
    return follows.map((f) => f.followedId);
  }

  async getUserMutualFollowers(
    requestedUserId: bigint,
    authFollowedIds: bigint[],
    limit: number,
    prevCursor: FollowsCursor | undefined,
  ) {
    return await this.prisma.follow.findMany({
      where: {
        followedId: requestedUserId,
        followerId: { in: authFollowedIds }, // Filter at DB level
      },
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
   * Get all user IDs that a given user follows
   */
  async getFollowingIds(userId: bigint): Promise<bigint[]> {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followedId: true },
    });
    return follows.map((f) => f.followedId);
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

      // Decrement following and followers counts if there was a follow relationship
      const [followFromUserToBlocked, followFromBlockedToUser] = await Promise.all([
        tx.follow.findUnique({
          where: {
            followerId_followedId: {
              followerId: userId,
              followedId: blockedId,
            },
          },
        }),

        tx.follow.findUnique({
          where: {
            followerId_followedId: {
              followerId: blockedId,
              followedId: userId,
            },
          },
        }),
      ]);

      if (followFromUserToBlocked) {
        // Decrement following count for userId and follower count for blockedId
        await Promise.all([
          tx.user.update({
            where: { id: userId },
            data: { followingCount: { decrement: 1 } },
          }),

          tx.user.update({
            where: { id: blockedId },
            data: { followersCount: { decrement: 1 } },
          }),

          tx.follow.delete({
            where: {
              followerId_followedId: {
                followerId: userId,
                followedId: blockedId,
              },
            },
          }),
        ]);
      }

      if (followFromBlockedToUser) {
        // Decrement following count for blockedId and follower count for userId
        await Promise.all([
          tx.user.update({
            where: { id: blockedId },
            data: { followingCount: { decrement: 1 } },
          }),

          tx.user.update({
            where: { id: userId },
            data: { followersCount: { decrement: 1 } },
          }),

          tx.follow.delete({
            where: {
              followerId_followedId: {
                followerId: blockedId,
                followedId: userId,
              },
            },
          }),
        ]);
      }
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

  async getUserFollowRelations(userId: bigint, userIds: bigint[]) {
    return await this.prisma.follow.findMany({
      where: {
        OR: [
          { followerId: userId, followedId: { in: userIds } }, // user-> them
          { followerId: { in: userIds }, followedId: userId }, // them -> user
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
    return !!mute;
  }

  async getUserBlocks(userId: bigint) {
    return await this.prisma.block.findMany({
      where: {
        userId,
      },
      select: { userId: true, blockedId: true },
    });
  }

  async areUsersBlocked(firstUserId: bigint, secondUserId: bigint): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { userId: firstUserId, blockedId: secondUserId },
          { userId: secondUserId, blockedId: firstUserId },
        ],
      },
    });
    return !!block;
  }

  async getUserDetails(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        userDevices: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        sessions: {
          orderBy: {
            lastSeenAt: 'asc',
          },
        },
        country: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    if (user.deletedAt)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.FORBIDDEN,
      );

    const today = new Date();

    const birthDate = new Date(user.birthdate);

    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();

    const monthDifference = today.getUTCMonth() - birthDate.getUTCMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getUTCDate() < birthDate.getUTCDate())
    )
      age--;

    const response = {
      username: user.username,
      email: user.email,
      accountCreationDate: user.createdAt,
      accountCreationIp: user.userDevices[0]?.ipAddress || user.sessions[0]?.ipAddress || '0.0.0.0', // workaround as we currently don't store the original ip address of a user
      country: user.country?.name || null,
      languages: [user.languageCode],
      gender: user.gender,
      birthDate: user.birthdate.toISOString().split('T')[0] || null,
      age,
    };

    this.logger.log(`Finished getting user details for ${user.username}`);

    return response;
  }

  async updateBirthDate(userId: bigint, birthDate: Date) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        birthdate: birthDate,
      },
    });

    this.logger.log(`Update birthdate completed for ${user.username}`);

    return { message: 'Birth date updated successfully.' };
  }

  async getUserSSOs(userId: bigint) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    const userExternalAccounts = await this.prisma.userExternalAccount.findMany({
      where: { userId },
    });

    const filteredUserExternalAccounts = userExternalAccounts.map((acc) => {
      return {
        provider: acc.provider,
        displayIdentifier: user.email,
        status: 'Connected',
        connectedAt: acc.createdAt,
      };
    });

    this.logger.log(`Getting the user external accounts for ${user.username}`);

    return filteredUserExternalAccounts;
  }

  async validateLoggedInUser(userId: bigint, password: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (isMatch) {
        return true;
      }
    }
    return false;
  }

  async removeUserSSO(userId: bigint, provider: string) {
    const userExternalAccount = await this.prisma.userExternalAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!userExternalAccount)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    await this.prisma.userExternalAccount.delete({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    this.logger.log(`${provider} account removed for ${userExternalAccount.user.username}`);
  }

  async getCountries() {
    const data = await this.prisma.country.findMany({});

    const filteredCountries = data.map((country) => {
      return {
        code: country.code,
        name: country.name,
      };
    });

    return filteredCountries;
  }

  async checkCountry(countryName: string) {
    const country = await this.prisma.country.findFirst({
      where: {
        name: countryName,
      },
    });

    if (!country)
      throw new BadRequestException(
        createValidationError('invalidCountry', {
          invalidCountry: USERS_ERROR_MESSAGES.INVALID_COUNTRY,
        }),
      );

    return country;
  }

  async updateCountry(
    userId: bigint,
    country: {
      id: number;
      name: string;
      code: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        country: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    if (user.country && user.country.name === country.name) return;

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        countryId: country.id,
      },
    });
  }

  async updateGender(userId: bigint, gender: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    await this.prisma.user.update({
      where: { id: userId },
      data: { gender: gender === 'Male' ? 'MALE' : 'FEMALE' },
    });
  }

  async updateLanguage(userId: bigint, language: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    await this.prisma.user.update({
      where: { id: userId },
      data: { languageCode: language === 'AR' ? 'AR' : 'EN' },
    });
  }

  async updateInterests(userId: bigint, interests: string[]) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    await this.prisma.user.update({
      where: { id: userId },
      data: { interests },
    });
  }

  async getSessions(userId: bigint, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    let currentSessionId: bigint | null = null;

    try {
      const hashedRefreshToken = this.refreshTokensService.hashStringDeterministic(refreshToken);
      const token = await this.refreshTokensService.getTokenByHash(hashedRefreshToken);
      if (token && token.expiresAt >= new Date()) {
        currentSessionId = token.sessionId;
      }
    } catch {
      this.logger.warn('Failed to identify current session from refresh token');
    }

    const userSessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });

    const filteredSessions = userSessions.map((session) => ({
      id: session.id.toString(),
      deviceType: session.userAgent,
      lastActive: session.lastSeenAt,
      isCurrent: currentSessionId ? session.id === currentSessionId : false,
    }));
    this.logger.log(`Getting sessions for ${user.username}`);

    return filteredSessions;
  }

  async deleteSession(userId: bigint, sessionId: bigint, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        sessions: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    let currentSessionId: bigint | null = null;

    try {
      const hashedRefreshToken = this.refreshTokensService.hashStringDeterministic(refreshToken);
      const token = await this.refreshTokensService.getTokenByHash(hashedRefreshToken);
      if (token && token.expiresAt >= new Date()) {
        currentSessionId = token.sessionId;
      }
    } catch {
      this.logger.warn('Failed to identify current session from refresh token');
    }

    if (currentSessionId === sessionId)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.CANNOT_DELETE_CURRENT_SESSION,
          code: USERS_ERROR_CODES.CANNOT_DELETE_CURRENT_SESSION,
        },
        HttpStatus.FORBIDDEN,
      );
    const sessionToBeDeleted = user.sessions.find((session) => session.id === sessionId);

    if (!sessionToBeDeleted)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.SESSION_NOT_FOUND,
          code: USERS_ERROR_CODES.SESSION_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    await this.prisma.refreshToken.deleteMany({
      where: { sessionId: sessionToBeDeleted.id },
    });

    await this.prisma.session.delete({
      where: { id: sessionToBeDeleted.id },
    });

    this.logger.log(`Session ${sessionId} deleted for user ${user.username}`);
  }

  async updateBanner(userId: bigint, bannerUrl: string) {
    await this.prisma.profile.update({
      where: { userId },
      data: { bannerUrl },
    });
  }

  async updateAvatar(userId: bigint, avatarUrl: string) {
    await this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl },
    });
  }

  async deleteBanner(userId: bigint) {
    // Fetching first to get banner url and deleted it from media table and S3 bucket
    return await this.prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({
        where: { userId },
        select: { bannerUrl: true },
      });

      await tx.profile.update({
        where: { userId },
        data: { bannerUrl: null },
      });

      return { bannerUrl: profile?.bannerUrl || null };
    });
  }

  async getUserMutedUsers(userId: bigint, limit: number, prevCursor: MutesCursor | undefined) {
    return await this.prisma.mute.findMany({
      where: { userId },
      take: limit,
      cursor: prevCursor
        ? {
            userId_mutedId: {
              userId: BigInt(prevCursor.userId),
              mutedId: BigInt(prevCursor.mutedId),
            },
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { userId: 'asc' }, { mutedId: 'asc' }],
      include: {
        mutedUser: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                bio: true,
                bioEntities: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async getUserBlockedUsers(userId: bigint, limit: number, prevCursor: BlocksCursor | undefined) {
    return await this.prisma.block.findMany({
      where: { userId },
      take: limit,
      cursor: prevCursor
        ? {
            userId_blockedId: {
              userId: BigInt(prevCursor.userId),
              blockedId: BigInt(prevCursor.blockedId),
            },
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { userId: 'asc' }, { blockedId: 'asc' }],
      include: {
        blockedUser: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                bio: true,
                bioEntities: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async checkBatchUsernamesExistence(
    usernames: PlainMention[],
    prismaClient: Prisma.TransactionClient = this.prisma,
  ): Promise<Array<{ id: bigint; username: string }>> {
    const existingUsers = await prismaClient.user.findMany({
      where: {
        username: {
          in: usernames.map((mention) => mention.username),
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        username: true,
      },
    });

    return existingUsers;
  }
  async createProfile(userId: bigint, displayName: string) {
    return await this.prisma.profile.create({
      data: {
        userId,
        displayName,
      },
    });
  }

  async getUserBlockedBy(userId: bigint) {
    return this.prisma.block.findMany({
      where: {
        blockedId: userId,
      },
    });
  }

  async getBlockingBlockedState(user1: bigint, user2: bigint) {
    const block1 = await this.prisma.block.findUnique({
      where: { userId_blockedId: { userId: user1, blockedId: user2 } },
    });

    const block2 = await this.prisma.block.findUnique({
      where: { userId_blockedId: { userId: user2, blockedId: user1 } },
    });

    return !!(block1 || block2);
  }

  async getMatchingUsers(userId: bigint, username: string) {
    return await this.prisma.user.findMany({
      where: {
        OR: [
          {
            username: {
              contains: username,
              mode: 'insensitive',
            },
          },
          {
            profile: {
              displayName: {
                contains: username,
                mode: 'insensitive',
              },
            },
          },
        ],
        deletedAt: null,
        id: { not: userId },
      },
      select: {
        id: true,
        username: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ username: 'asc' }],
      take: 10,
    });
  }

  async findOwnTweetAuthorMetaData(userId: bigint): Promise<CompactAuthorDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        id: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    return {
      username: user.username,
      displayName: user.profile?.displayName || '',
      avatarUrl: user.profile?.avatarUrl,
    };
  }

  async searchUsers(
    currentUserId: bigint,
    query: string,
    limit: number,
    decodedCursor: UserSearchCursor | undefined,
    excludeMutedAndBlocked: boolean = false,
    peopleFilter: PeopleSearchFilter = PeopleSearchFilter.Anyone,
  ) {
    const { cursorCondition, mutedAndBlockedCondition, peopleFilterCondition } =
      this.buildUserSearchFilters(
        currentUserId,
        excludeMutedAndBlocked,
        peopleFilter,
        decodedCursor,
      );

    const rankingScoreSql = this.buildUsersRankingScore();

    const sqlQuery = Prisma.sql`
   -- First get matching user ids with username or display name similar to query
    WITH matched_ids AS (
      SELECT 
        id as user_id 
        FROM users WHERE deleted_at IS NULL
        AND (LOWER(username) % ${query})

      UNION

      SELECT user_id 
      FROM profiles
      WHERE LOWER(display_name) % ${query}
    ),

  ranked_users AS (
    SELECT 
      u.id, 
      u.username,
      u.created_at,
      u.followers_count,
      p.display_name,
      p.avatar_url,
      p.banner_url,
      p.bio,
      p.bio_entities,
      SIMILARITY(LOWER(u.username), ${query}) AS sim_username,
      COALESCE(SIMILARITY(LOWER(p.display_name), ${query}), 0) AS sim_display_name,
      (f_out.follower_id IS NOT NULL) AS i_follow,
      (f_in.follower_id IS NOT NULL) AS follows_me 
    FROM matched_ids matched_user
    JOIN users u ON matched_user.user_id = u.id
    JOIN profiles p ON matched_user.user_id = p.user_id
    LEFT JOIN follows f_out ON f_out.follower_id = ${currentUserId} AND f_out.followed_id = u.id
    LEFT JOIN follows f_in ON f_in.follower_id = u.id AND f_in.followed_id = ${currentUserId}
    WHERE 1 = 1
      ${mutedAndBlockedCondition}
      ${peopleFilterCondition}
    ),
    scored_users AS (
      SELECT *, ${rankingScoreSql} 
      FROM ranked_users
    )
    SELECT *
    FROM scored_users
    WHERE 1=1
    ${cursorCondition}
    ORDER BY ranking_score DESC, id DESC
    LIMIT ${limit};
`;

    const results = await this.prisma.$queryRaw<RankedUser[]>(sqlQuery);

    return results.map((row) => ({
      id: row.id.toString(),
      username: row.username,
      displayName: row.display_name || '',
      avatarUrl: row.avatar_url,
      bannerUrl: row.banner_url || null,
      bio: row.bio || null,
      bioEntities: row.bio_entities || null,
      createdAt: row.created_at,
      rankingScore: row.ranking_score,
    }));
  }

  private buildUserSearchFilters(
    currentUserId: bigint,
    excludeMutedAndBlocked: boolean,
    peopleFilter: PeopleSearchFilter,
    cursor: UserSearchCursor | undefined,
  ) {
    const cursorScore = cursor ? BigInt(cursor.rankingScore) : null;
    const cursorId = cursor ? BigInt(cursor.id) : null;

    const cursorCondition = cursor
      ? Prisma.sql`
        AND (
          ranking_score < ${cursorScore}
          OR (ranking_score = ${cursorScore} AND id <= ${cursorId})
        )
      `
      : Prisma.empty;

    const mutedAndBlockedCondition = excludeMutedAndBlocked
      ? Prisma.sql`
            AND NOT EXISTS (
              SELECT 1 
              FROM blocks b 
              WHERE b.user_id = ${currentUserId} AND b.blocked_id = u.id
            )
            AND NOT EXISTS (
              SELECT 1 
              FROM mutes m 
              WHERE m.user_id = ${currentUserId} AND m.muted_id = u.id
            )
          `
      : Prisma.empty;

    const peopleFilterCondition =
      peopleFilter === PeopleSearchFilter.Following
        ? Prisma.sql`
            AND EXISTS (
              SELECT 1 
              FROM follows f 
              WHERE f.follower_id = ${currentUserId} AND f.followed_id = u.id
            )
          `
        : Prisma.empty;

    return {
      cursorCondition,
      mutedAndBlockedCondition,
      peopleFilterCondition,
    };
  }

  /**
   * Builds the ranking score SQL snippet for user search.
   * Score = sim_score * sim_weight + followers_count * followers_weight + i_follow_weight + follows_me_weight
   */
  private buildUsersRankingScore() {
    return Prisma.sql`
    (
      CAST( (COALESCE(sim_username, 0) + COALESCE(sim_display_name, 0)) * ${USER_SEARCH_RANKING_WEIGHTS.SIMILARITY} AS BIGINT )  +
      (LEAST(followers_count, ${USER_SEARCH_RANKING_WEIGHTS.MAX_FOLLOWERS_COUNT}) * (${USER_SEARCH_RANKING_WEIGHTS.FOLLOWERS})::bigint) +
      (CASE WHEN i_follow THEN ${USER_SEARCH_RANKING_WEIGHTS.I_FOLLOW}::bigint ELSE 0 END) +
      (CASE WHEN follows_me THEN ${USER_SEARCH_RANKING_WEIGHTS.FOLLOWS_ME}::bigint ELSE 0 END)
    ) as ranking_score`;
  }

  async getUsersRelationshipsMap(
    currentUserId: bigint,
    userIds: bigint[],
  ): Promise<Map<bigint, UserRelationshipDto>> {
    const relationshipsMap = new Map<bigint, UserRelationshipDto>();
    if (!userIds || userIds.length === 0) {
      return relationshipsMap;
    }

    const results = await this.prisma.$queryRaw<
      {
        user_id: bigint;
        is_blocking: boolean | number;
        is_blocked_by: boolean | number;
        is_following: boolean | number;
        is_follower: boolean | number;
        is_muted: boolean | number;
      }[]
    >`
      SELECT 
        u.id AS user_id,
        EXISTS (
          SELECT 1 FROM blocks b 
          WHERE b.user_id = ${currentUserId} AND b.blocked_id = u.id
        ) AS is_blocking,
        EXISTS (
          SELECT 1 FROM blocks b 
          WHERE b.user_id = u.id AND b.blocked_id = ${currentUserId}
        ) AS is_blocked_by,
        EXISTS (
          SELECT 1 FROM follows f 
          WHERE f.follower_id = ${currentUserId} AND f.followed_id = u.id
        ) AS is_following,
        EXISTS (
          SELECT 1 FROM follows f 
          WHERE f.follower_id = u.id AND f.followed_id = ${currentUserId}
        ) AS is_follower,
        EXISTS (
          SELECT 1 FROM mutes m 
          WHERE m.user_id = ${currentUserId} AND m.muted_id = u.id
        ) AS is_muted
      FROM users u
      WHERE u.id IN (${Prisma.join(userIds)});
    `;

    // 3. Map results
    for (const row of results) {
      // Boolean() conversion handles cases where DB driver returns 1/0 instead of true/false
      relationshipsMap.set(row.user_id, {
        blocking: Boolean(row.is_blocking),
        blockedBy: Boolean(row.is_blocked_by),
        following: Boolean(row.is_following),
        follower: Boolean(row.is_follower),
        muted: Boolean(row.is_muted),
      });
    }

    return relationshipsMap;
  }

  async getFollowersUnPaginated(userId: bigint): Promise<bigint[]> {
    return this.prisma.follow
      .findMany({
        where: { followedId: userId },
        select: { followerId: true },
      })
      .then((followers) => followers.map((follow) => follow.followerId));
  }

  getMutingUsersUnPaginated(mutedId: bigint): Promise<bigint[]> {
    return this.prisma.mute
      .findMany({
        where: { mutedId },
        select: { userId: true },
      })
      .then((mutings) => mutings.map((mute) => mute.userId));
  }

  async toggleUserNotifications(userId: bigint, followedId: bigint, enable: boolean) {
    if (enable) {
      const isBlocked = await this.areUsersBlocked(userId, followedId);
      if (isBlocked) {
        throw new HttpException(
          {
            message: USERS_ERROR_MESSAGES.CANNOT_FOLLOW_USER,
            code: USERS_ERROR_CODES.CANNOT_FOLLOW_USER,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return await this.prisma.follow.upsert({
      where: {
        followerId_followedId: { followerId: userId, followedId: followedId },
      },
      create: {
        followerId: userId,
        followedId: followedId,
        withNotifications: enable,
      },
      update: {
        withNotifications: enable,
      },
    });
  }

  async findByUsernameWithDisplayname(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        profile: {
          select: {
            displayName: true,
          },
        },
      },
    });
  }

  async getOnboardingFollowSuggestions(userId: bigint, limit: number) {
    const sqlQuery = Prisma.sql`
    WITH suggestions AS (
      SELECT 
        u.id,
        u.username,
        u.followers_count,
        p.display_name,
        p.avatar_url,
        p.bio,
        p.bio_entities,
        COALESCE(
          (SELECT COUNT(*) 
           FROM follows f1
           WHERE f1.followed_id = u.id
           AND f1.follower_id IN (
             SELECT followed_id 
             FROM follows f2 
             WHERE f2.follower_id = ${userId}
           )
          ), 0
        ) as mutual_count,
        EXISTS (
          SELECT 1 FROM blocks b 
          WHERE b.user_id = ${userId} AND b.blocked_id = u.id
        ) AS is_blocking,
        EXISTS (
          SELECT 1 FROM blocks b 
          WHERE b.user_id = u.id AND b.blocked_id = ${userId}
        ) AS is_blocked_by,
        EXISTS (
          SELECT 1 FROM follows f 
          WHERE f.follower_id = ${userId} AND f.followed_id = u.id
        ) AS is_following,
        EXISTS (
          SELECT 1 FROM follows f 
          WHERE f.follower_id = u.id AND f.followed_id = ${userId}
        ) AS is_follower,
        EXISTS (
          SELECT 1 FROM mutes m 
          WHERE m.user_id = ${userId} AND m.muted_id = u.id
        ) AS is_muted
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.id != ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM mutes m 
        WHERE m.user_id = ${userId} AND m.muted_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM blocks b 
        WHERE (b.user_id = ${userId} AND b.blocked_id = u.id)
        OR (b.user_id = u.id AND b.blocked_id = ${userId})
      )
      AND NOT EXISTS (
        SELECT 1 FROM follows f 
        WHERE f.follower_id = ${userId} AND f.followed_id = u.id
      )
      ORDER BY mutual_count DESC, u.followers_count DESC
      LIMIT ${limit}
    )
    SELECT id, username, display_name, avatar_url, bio, bio_entities,  is_follower 
    FROM suggestions;
`;
    const results = await this.prisma.$queryRaw<
      {
        id: bigint;
        username: string;
        display_name: string;
        avatar_url: string | null;
        bio: string | null;
        bio_entities: Prisma.JsonValue | null;
        is_follower: boolean | number;
      }[]
    >(sqlQuery);

    return results.map((row) => ({
      id: row.id.toString(),
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      bioEntities: row.bio_entities,
      relationship: {
        isFollower: Boolean(row.is_follower),
      },
    }));
  }
}
