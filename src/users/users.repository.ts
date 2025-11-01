import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { NewUser } from './interfaces/NewUser.interface';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants/users.constants';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UserProfileResponseDto, UserRelationshipDto } from './dtos/user-profile-response.dto';
import { DEFAULT_PROFILE_PICTURE } from './constants/users';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { createValidationError } from 'src/common/utils/create-validation-error.util';

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
        HttpStatus.UNAUTHORIZED,
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
        HttpStatus.UNAUTHORIZED,
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
        HttpStatus.UNAUTHORIZED,
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
        HttpStatus.UNAUTHORIZED,
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
        HttpStatus.UNAUTHORIZED,
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
          invalidCountry: 'The country you entered is not supported',
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
        HttpStatus.UNAUTHORIZED,
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
        HttpStatus.UNAUTHORIZED,
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
        HttpStatus.UNAUTHORIZED,
      );

    await this.prisma.user.update({
      where: { id: userId },
      data: { languageCode: language === 'AR' ? 'AR' : 'EN' },
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
        HttpStatus.UNAUTHORIZED,
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
        HttpStatus.UNAUTHORIZED,
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
        HttpStatus.UNAUTHORIZED,
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
}
