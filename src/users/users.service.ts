import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NewUser } from './interfaces';
import { comparePassword, hashPassword } from 'src/auth/utils';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants';
import { ChangePasswordBasicDto, UpdateProfileDto } from './dtos';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailJobData, OtpType } from 'src/email/interfaces';
import { validateNewPasswordFormat } from './utils';
import { createValidationError } from 'src/common/utils';
import { AUTH_ERROR_MESSAGES } from 'src/auth/constants';
import { MediaService } from 'src/media/media.service';
import { MediaFolder } from 'src/media/enums';
import { BlocksCursor } from 'src/common/interfaces';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async findByUsername(username: string) {
    return this.usersRepository.findByUsername(username);
  }

  async checkUsernameExistence(id: string, username: string) {
    return this.usersRepository.checkUsernameExistence(id, username);
  }

  /**
   * Retrieves a user by their unique identifier, which can be either their email or username.
   *
   * @param identifier - The user's email or username.
   * @returns The matching user record, or `null` if no user is found.
   */
  async findByIdentifier(identifier: string) {
    return this.usersRepository.findByIdentifier(identifier);
  }

  /**
   * Update user's password by user id
   */
  async updatePasswordById(userId: bigint, hashedPassword: string) {
    return this.usersRepository.updatePasswordById(userId, hashedPassword);
  }

  async createUser(newUser: NewUser, tx: Prisma.TransactionClient = this.prisma) {
    return this.usersRepository.createUser(newUser, tx);
  }

  /**
   * Changes the password for a user after validating the current password and the format of the new password.
   * Then it sends an email about the password change.
   *
   * @param userId - The ID of the user whose password is to be changed.
   * @param changePasswordDto - Data Transfer Object containing the current and new passwords.
   *
   * @returns A message indicating the result of the password change operation.
   */
  async changePassword(
    userId: bigint,
    changePasswordDto: ChangePasswordBasicDto,
  ): Promise<{ message: string }> {
    const { currentPassword: oldPassword, newPassword } = changePasswordDto;

    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Validate old password (OAuth might not have password)
    let isOldPasswordValid = false;
    if (user.passwordHash) {
      isOldPasswordValid = await comparePassword(oldPassword, user.passwordHash);
    }

    if (!isOldPasswordValid) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.INVALID_OLD_PASSWORD,
          code: USERS_ERROR_CODES.INVALID_OLD_PASSWORD,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    await validateNewPasswordFormat(changePasswordDto);

    // Check if new password is different from old password
    let isSamePassword = false;
    if (user.passwordHash) {
      isSamePassword = await comparePassword(newPassword, user.passwordHash);
    }

    if (isSamePassword) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.NEW_PASSWORD_SAME_AS_OLD,
          code: USERS_ERROR_CODES.NEW_PASSWORD_SAME_AS_OLD,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Update password
    const hashedNewPassword = await hashPassword(newPassword);
    await this.usersRepository.updatePasswordById(userId, hashedNewPassword);

    // Send password change email
    const jobData: EmailJobData = {
      email: user.email,
      username: user.username,
      type: OtpType.CHANGE_PASSWORD,
    };
    await this.emailQueue.add('sendPasswordChangeEmail', jobData);

    this.logger.log(`Password changed for user ID: ${user.id}`);
    return { message: 'Password changed successfully.' };
  }

  async updateProfile(userId: bigint, data: UpdateProfileDto) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const profile = await this.usersRepository.updateProfile(userId, data);

    return {
      message: 'Profile updated successfully',
      ...profile,
    };
  }

  /**
   * Fetches the public profile data for a given user by their username.
   *
   * If a `currentUserId` is provided, the method also includes relationship metadata
   * between the current user and the target user (e.g. following status, mutuals, etc.).
   *
   * The `isMyProfile` flag can be set to `true` to indicate that the request
   * is for the authenticated user's own profile, then the user profile will be returned with the relationship metadata set to null.
   *
   * @param username - The unique username of the user whose profile is being requested.
   * @param currentUserId - (Optional) The ID of the authenticated user, used to fetch relationship context.
   * @param isMyProfile - (Optional) Whether the profile being requested belongs to the authenticated user.
   *
   * @returns A user profile object, optionally enriched with relationship data.
   */
  async getUserProfile(username: string, currentUserId?: bigint, isMyProfile: boolean = false) {
    const profile = await this.usersRepository.findUserProfileByUsername(
      username,
      currentUserId,
      isMyProfile,
    );

    if (!profile) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return profile;
  }

  async updateUsernameById(userId: bigint, newUsername: string) {
    await this.usersRepository.updateUsernameById(userId, newUsername);

    return { message: 'Username updated successfully.' };
  }

  async findById(userId: bigint) {
    return this.usersRepository.findById(userId);
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
    if (!emailUpdateData.verified) {
      throw new BadRequestException(
        createValidationError('otp', {
          invalidToken: AUTH_ERROR_MESSAGES.OTP_NOT_VERIFIED,
        }),
      );
    }

    return this.usersRepository.updateUserEmail(userId, emailUpdateData);
  }

  async followUser(followerId: bigint, followedUsername: string) {
    const followedUser = await this.usersRepository.findByUsername(followedUsername);
    if (!followedUser || followedUser.deletedAt) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const followedId = followedUser.id;

    // User cannot follow themselves
    if (followerId === followedId) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.CANNOT_FOLLOW_SELF,
          code: USERS_ERROR_CODES.CANNOT_FOLLOW_SELF,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Check if already following
    const isAlreadyFollowing = await this.usersRepository.isFollowing(followerId, followedId);
    if (isAlreadyFollowing) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.ALREADY_FOLLOWING,
          code: USERS_ERROR_CODES.ALREADY_FOLLOWING,
        },
        HttpStatus.CONFLICT,
      );
    }

    // Check if user is blocked or you blocked the user
    const userBlockedYou = await this.usersRepository.isBlocked(followedId, followerId);
    const youBlockedUser = await this.usersRepository.isBlocked(followerId, followedId);
    if (youBlockedUser || userBlockedYou) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.CANNOT_FOLLOW_USER,
          code: USERS_ERROR_CODES.CANNOT_FOLLOW_USER,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.usersRepository.followUser(followerId, followedId);

    this.logger.log(`User ID: ${followerId} followed User ID: ${followedId}`);
    return { message: 'User followed successfully.' };
  }

  async unfollowUser(followerId: bigint, followedUsername: string) {
    // Check if the target user exists
    const followedUser = await this.usersRepository.findByUsername(followedUsername);
    if (!followedUser || followedUser.deletedAt) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const followedId = followedUser.id;
    // Check if currently following
    const isFollowing = await this.usersRepository.isFollowing(followerId, followedId);
    if (!isFollowing) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.ALREADY_NOT_FOLLOWING,
          code: USERS_ERROR_CODES.ALREADY_NOT_FOLLOWING,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.usersRepository.unfollowUser(followerId, followedId);
    this.logger.log(`User ID: ${followerId} unfollowed User ID: ${followedId}`);

    return { message: 'User unfollowed successfully.' };
  }

  async blockUser(userId: bigint, blockedUsername: string) {
    // Check if the target user exists
    const blockedUser = await this.usersRepository.findByUsername(blockedUsername);
    if (!blockedUser || blockedUser.deletedAt) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const blockedId = blockedUser.id;
    // User cannot block themselves
    if (userId === blockedId) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.CANNOT_BLOCK_SELF,
          code: USERS_ERROR_CODES.CANNOT_BLOCK_SELF,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Check if user blocked you
    const userBlockedYou = await this.usersRepository.isBlocked(blockedId, userId);
    if (userBlockedYou) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.CANNOT_BLOCK_USER,
          code: USERS_ERROR_CODES.CANNOT_BLOCK_USER,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Check if already blocked
    const isAlreadyBlocked = await this.usersRepository.isBlocked(userId, blockedId);
    if (isAlreadyBlocked) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.ALREADY_BLOCKED,
          code: USERS_ERROR_CODES.ALREADY_BLOCKED,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.usersRepository.blockUser(userId, blockedId);
    this.logger.log(`User ID: ${userId} blocked User ID: ${blockedId}`);

    return { message: 'User blocked successfully.' };
  }

  async unblockUser(blockerId: bigint, blockedUsername: string) {
    const blockedUser = await this.usersRepository.findByUsername(blockedUsername);
    if (!blockedUser || blockedUser.deletedAt) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const blockedId = blockedUser.id;
    // Check if currently blocked
    const isBlocked = await this.usersRepository.isBlocked(blockerId, blockedId);
    if (!isBlocked) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.NOT_BLOCKED,
          code: USERS_ERROR_CODES.NOT_BLOCKED,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.usersRepository.unblockUser(blockerId, blockedId);
    this.logger.log(`User ID: ${blockerId} unblocked User ID: ${blockedId}`);

    return { message: 'User unblocked successfully.' };
  }

  async muteUser(userId: bigint, mutedUsername: string) {
    // Check if the target user exists
    const targetUser = await this.usersRepository.findByUsername(mutedUsername);
    if (!targetUser || targetUser.deletedAt) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const mutedId = targetUser.id;
    // User cannot mute themselves
    if (userId === mutedId) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.CANNOT_MUTE_SELF,
          code: USERS_ERROR_CODES.CANNOT_MUTE_SELF,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if already muted
    const isAlreadyMuted = await this.usersRepository.isMuted(userId, mutedId);
    if (isAlreadyMuted) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.ALREADY_MUTED,
          code: USERS_ERROR_CODES.ALREADY_MUTED,
        },
        HttpStatus.CONFLICT,
      );
    }

    const userBlockedYou = await this.usersRepository.isBlocked(mutedId, userId);
    if (userBlockedYou) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.CANNOT_MUTE_USER,
          code: USERS_ERROR_CODES.CANNOT_MUTE_USER,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.usersRepository.muteUser(userId, mutedId);
    this.logger.log(`User ID: ${userId} muted User ID: ${mutedId}`);

    return { message: 'User muted successfully.' };
  }

  async unmuteUser(userId: bigint, mutedUsername: string) {
    const mutedUser = await this.usersRepository.findByUsername(mutedUsername);
    if (!mutedUser || mutedUser.deletedAt) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const mutedId = mutedUser.id;

    // Check if user is blocked (either direction)
    const youBlockedUser = await this.usersRepository.isBlocked(userId, mutedId);
    const userBlockedYou = await this.usersRepository.isBlocked(mutedId, userId);

    if (youBlockedUser || userBlockedYou) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.CANNOT_UNMUTE_USER,
          code: USERS_ERROR_CODES.CANNOT_UNMUTE_USER,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const isMuted = await this.usersRepository.isMuted(userId, mutedId);
    if (!isMuted) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.NOT_MUTED,
          code: USERS_ERROR_CODES.NOT_MUTED,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.usersRepository.unmuteUser(userId, mutedId);
    this.logger.log(`User ID: ${userId} unmuted User ID: ${mutedId}`);

    return { message: 'User unmuted successfully.' };
  }

  async getUserDetails(userId: bigint) {
    return this.usersRepository.getUserDetails(userId);
  }

  async updateBirthDate(userId: bigint, birthDate: Date) {
    return this.usersRepository.updateBirthDate(userId, birthDate);
  }

  async getUserSSOs(userId: bigint) {
    return this.usersRepository.getUserSSOs(userId);
  }

  async validateLoggedInUser(userId: bigint, currentPassword: string) {
    return await this.usersRepository.validateLoggedInUser(userId, currentPassword);
  }

  async removeUserSSO(userId: bigint, provider: string, currentPassword: string) {
    const correctPassword = await this.validateLoggedInUser(userId, currentPassword);

    if (!correctPassword)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.INVALID_PASSWORD,
          code: USERS_ERROR_CODES.INVALID_PASSWORD,
        },
        HttpStatus.UNAUTHORIZED,
      );

    await this.usersRepository.removeUserSSO(userId, provider);

    return { message: 'Account disconnected successfully.' };
  }

  async getCountries() {
    return this.usersRepository.getCountries();
  }

  async changeCountry(userId: bigint, countryName: string) {
    const country = await this.usersRepository.checkCountry(countryName);

    await this.usersRepository.updateCountry(userId, country);

    return { message: 'Country updated successfully.' };
  }

  async updateGender(userId: bigint, gender: string) {
    await this.usersRepository.updateGender(userId, gender);

    return { message: 'Gender updated successfully.' };
  }

  async updateLanguage(userId: bigint, gender: string) {
    await this.usersRepository.updateLanguage(userId, gender);

    return { message: 'Default language updated successfully.' };
  }

  async getSessions(userid: bigint, refreshToken: string) {
    return this.usersRepository.getSessions(userid, refreshToken);
  }

  async deleteSession(userId: bigint, sessionId: bigint, refreshToken: string) {
    await this.usersRepository.deleteSession(userId, sessionId, refreshToken);

    return { message: 'Session terminated successfully.' };
  }

  // NOTE: This is a temporary function (it is not atomic operation since it is gonna be deleted anyways)
  async uploadBanner(userId: bigint, banner: Express.Multer.File) {
    const bannerUrl = await this.mediaService.uploadAndSaveMedia(
      banner,
      userId,
      MediaFolder.BANNERS,
    );

    await this.usersRepository.updateBanner(userId, bannerUrl);

    return { message: 'Banner uploaded successfully', bannerUrl };
  }

  // NOTE: This is a temporary function (it is not atomic operation since it is gonna be deleted anyways)
  async uploadAvatar(userId: bigint, avatar: Express.Multer.File) {
    const avatarUrl = await this.mediaService.uploadAndSaveMedia(
      avatar,
      userId,
      MediaFolder.AVATARS,
    );

    await this.usersRepository.updateAvatar(userId, avatarUrl);

    return { message: 'Avatar uploaded successfully', avatarUrl };
  }

  // NOTE: This is a temporary function (it is not atomic operation since it is gonna be deleted anyways)
  async deleteBanner(userId: bigint) {
    const { bannerUrl } = await this.usersRepository.deleteBanner(userId);

    if (!bannerUrl) {
      throw new HttpException(
        {
          message: USERS_ERROR_CODES.BANNER_NOT_FOUND,
          code: USERS_ERROR_MESSAGES.BANNER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (bannerUrl) {
      await this.mediaService.deleteMedia(bannerUrl, userId);
    }

    return { message: 'Banner deleted successfully' };
  }

  async getUserBlocks(userId: bigint, limit: number, prevCursor: BlocksCursor | undefined) {
    return this.usersRepository.getUserBlockedUsers(userId, limit, prevCursor);
  }
}
