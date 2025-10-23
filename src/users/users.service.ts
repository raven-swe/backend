import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { LanguageCode } from '@prisma/client';
import { comparePassword, hashPassword } from 'src/auth/utils/password.util';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants/users.constants';
import { ChangePasswordBasicDto } from './dtos/change-password-basic.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailJobData, OtpType } from 'src/email/interfaces/email.interfaces';
import { validateNewPasswordFormat } from './utils/validate-password-format.util';
import { UpdateProfileDto } from './dtos/update-profile.dto';
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
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

  async createUser(data: {
    email: string;
    username: string;
    password: string;
    birthDate: Date;
    languageCode: LanguageCode;
  }) {
    return this.usersRepository.createUser(data);
  }

  /**
   * Update user's password by user id
   */
  async updatePasswordById(userId: bigint, hashedPassword: string) {
    return this.usersRepository.updatePasswordById(userId, hashedPassword);
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
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if user has a password (OAuth users might not have one)
    if (!user.password_hash) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.PASSWORD_NOT_SET,
          code: USERS_ERROR_CODES.PASSWORD_NOT_SET,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate old password
    const isOldPasswordValid = await comparePassword(oldPassword, user.password_hash);
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
    const isSamePassword = await comparePassword(newPassword, user.password_hash);
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

    // Prepare updated data
    const updatedData: Partial<UpdateProfileDto> = {};

    if (data.displayName !== undefined) updatedData.displayName = data.displayName;
    if (data.bio !== undefined) updatedData.bio = data.bio;
    if (data.location !== undefined) updatedData.location = data.location;
    if (data.websiteUrl !== undefined) updatedData.websiteUrl = data.websiteUrl;
    if (data.avatarUrl !== undefined) updatedData.avatarUrl = data.avatarUrl;
    if (data.bannerUrl !== undefined) updatedData.bannerUrl = data.bannerUrl;

    return await this.usersRepository.updateProfile(userId, updatedData);
  }
}
