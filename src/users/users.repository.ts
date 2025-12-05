import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { NewUser } from './interfaces';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/users/constants';
import {
  BioEntitiesDto,
  MutualUserDto,
  UpdateProfileDto,
  UserProfileResponseDto,
  UserRelationshipDto,
} from './dtos';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PlainMention } from 'src/tweets/interfaces';
import { createValidationError } from 'src/common/utils';
import { BlocksCursor, FollowsCursor, MutesCursor } from 'src/common/interfaces';
import { AuthorDto } from 'src/tweets/dtos';
import { plainToClass } from 'class-transformer';
import { authorSelect } from 'src/tweets/tweets.repository';
import { UserRelationshipDto } from './dtos/relationship-dto';

@Injectable()
export class UsersRepository {
  private readonly logger = new Logger(UsersRepository.name);

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
        _count: {
          select: {
            following: true,
            followers: true,
          },
        },
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
        followingCount: user._count.following,
        followersCount: user._count.followers,
        mutualsCount: null,
        mutualUsers: null,
      };

      // TODO: Get mutual followers count and names
    }

    const relationship: UserRelationshipDto = isMyProfile
      ? { blocking: false, blockedBy: false, following: false, follower: false, muted: false }
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
      followingCount: user._count.following,
      followersCount: user._count.followers,
      mutualsCount: mutualsCount,
      mutualUsers: mutualUsers,
      email: isMyProfile ? user.email : undefined,
      phone: user.phone || undefined,
      languageCode: user.languageCode || undefined,
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

  async getUserBlockRelations(userId: bigint, userIds?: bigint[]) {
    const hasUserIds = Array.isArray(userIds) && userIds.length > 0;

    return this.prisma.block.findMany({
      where: {
        OR: [
          {
            userId,
            ...(hasUserIds && { blockedId: { in: userIds } }),
          },
          {
            ...(hasUserIds && { userId: { in: userIds } }),
            blockedId: userId,
          },
        ],
      },

      select: { userId: true, blockedId: true },
    });
  }

  async getUserMuteRelations(userId: bigint, userIds: bigint[]) {
    return await this.prisma.mute.findMany({
      where: {
        OR: [
          { userId, mutedId: { in: userIds } }, // user-> them
        ],
      },
      select: { userId: true, mutedId: true },
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
      accountCreationIp: user.userDevices[0].ipAddress, // workaround as we currently don't store the original ip address of a user
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

  private hashStringDeterministic(str: string) {
    const hash = crypto.createHash('sha256');
    hash.update(str);
    return hash.digest('hex');
  }

  private async getTokenByHash(hash: string) {
    return await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash: hash,
      },
      include: {
        userDevice: true,
      },
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

    let currentDeviceId: bigint | null = null;

    try {
      const hashedRefreshToken = this.hashStringDeterministic(refreshToken);
      const token = await this.getTokenByHash(hashedRefreshToken);
      if (token && token.expiresAt >= new Date()) {
        currentDeviceId = token.deviceId;
      }
    } catch {
      this.logger.warn('Failed to identify current device from refresh token');
    }

    const userSessions = await this.prisma.userDevice.findMany({
      where: { userId: userId },
      orderBy: { lastUsedAt: 'desc' },
    });

    const filteredSessions = userSessions.map((session) => {
      return {
        id: session.id.toString(),
        deviceType: session.deviceType,
        lastActive: session.lastUsedAt,
        isCurrent: currentDeviceId ? session.id === currentDeviceId : false,
      };
    });

    this.logger.log(`Getting sessions for ${user.username}`);

    return filteredSessions;
  }

  async deleteSession(userId: bigint, sessionId: bigint, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        userDevices: {
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

    let currentDeviceId: bigint | null = null;

    try {
      const hashedRefreshToken = this.hashStringDeterministic(refreshToken);
      const token = await this.getTokenByHash(hashedRefreshToken);
      if (token && token.expiresAt >= new Date()) {
        currentDeviceId = token.deviceId;
      }
    } catch {
      this.logger.warn('Failed to identify current device from refresh token');
    }

    if (currentDeviceId === sessionId)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.CANNOT_DELETE_CURRENT_SESSION,
          code: USERS_ERROR_CODES.CANNOT_DELETE_CURRENT_SESSION,
        },
        HttpStatus.FORBIDDEN,
      );
    const sessionToBeDeleted = user.userDevices.find((device) => device.id === sessionId);

    if (!sessionToBeDeleted)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.SESSION_NOT_FOUND,
          code: USERS_ERROR_CODES.SESSION_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    await this.prisma.refreshToken.deleteMany({
      where: { deviceId: sessionToBeDeleted.id },
    });

    await this.prisma.userDevice.delete({
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

  async findOwnTweetAuthorMetaData(userId: bigint): Promise<AuthorDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
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

  async findByUsernameWithDisplayname(username: string) {
    return await this.prisma.user.findUnique({
      where: { username },
      include: {
        profile: {
          select: {
            displayName: true,
          },
        },
      },
    });
  }

  /**
   * Get a map of user IDs to their relationship status with the current user.
   *
   * @param currentUserId - ID of the current user
   * @param userIds - Array of user IDs to get relationships for
   *
   * @returns A map where the key is the user ID and the value is the UserRelationshipDto
   */

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

    for (const row of results) {
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
}
