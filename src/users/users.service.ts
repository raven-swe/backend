import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NewUser } from './interfaces/NewUser.interface';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { comparePassword, hashPassword } from 'src/auth/utils/password.util';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants/users.constants';
import { ChangePasswordBasicDto } from './dtos/change-password-basic.dto';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
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
   * Validates new password format using ChangePasswordDto rules.
   */
  private async validateNewPasswordFormat(changePasswordDto: ChangePasswordBasicDto) {
    const fullDto = plainToClass(ChangePasswordDto, changePasswordDto);
    const errors = await validate(fullDto);

    if (errors.length > 0) {
      const formattedErrors = errors.map((err) => ({
        property: err.property,
        constraints: err.constraints || {},
      }));

      throw new HttpException({ message: formattedErrors }, HttpStatus.BAD_REQUEST);
    }
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

    await this.validateNewPasswordFormat(changePasswordDto);

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

    // Send an email about password change - TODO

    return { message: 'Password changed successfully.' };
  }
}
