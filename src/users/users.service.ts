import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NewUser } from './interfaces/NewUser.interface';
import { comparePassword, hashPassword } from 'src/auth/utils/password.util';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants/users.constants';
import { ChangePasswordBasicDto } from './dtos/change-password-basic.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailJobData, OtpType } from 'src/email/interfaces/email.interfaces';
import { validateNewPasswordFormat } from './utils/validate-password-format.util';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { AUTH_ERROR_MESSAGES } from 'src/auth/constants/auth.constants';
import { MediaService } from 'src/media/media.service';

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

  /**
   * Updates the profile of a user, including optional avatar and banner image uploads.
   *
   * @param userId - The ID of the user whose profile is to be updated.
   * @param data - The profile data to be updated.
   * @param files - Optional files containing avatar and banner images.
   * @returns
   */
  async updateProfile(
    userId: bigint,
    data: UpdateProfileDto,
    files?: {
      avatar?: Express.Multer.File[];
      banner?: Express.Multer.File[];
    },
  ) {
    this.logger.debug('Received: ', data, files);
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

    // Upload files if provided and get URLs
    let avatarUrl: string | undefined;
    let bannerUrl: string | undefined;

    if (files && (files.avatar || files.banner)) {
      const filesToUpload: {
        avatar?: Express.Multer.File;
        banner?: Express.Multer.File;
      } = {
        avatar: files.avatar ? files.avatar[0] : undefined,
        banner: files.banner ? files.banner[0] : undefined,
      };

      const uploadResult = await this.mediaService.uploadAvatarAndBanner(user.id, filesToUpload);

      // Assign URLs if they were uploaded to return them to the user
      avatarUrl = uploadResult.avatarUrl ?? undefined;
      bannerUrl = uploadResult.bannerUrl ?? undefined;
    }

    const profile = await this.usersRepository.updateProfile(userId, data, avatarUrl, bannerUrl);

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
}
