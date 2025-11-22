import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/users/constants';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  InititateEmailUpdateDto,
  VerifyEmailUpdateDto,
  ResendEmailUpdateOtp,
  UpdateUsernameDto,
} from 'src/users/dtos';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';
import { AUTH_CONFIG, AUTH_ERROR_MESSAGES, REDIS_KEYS } from 'src/auth/constants';
import { EmailJobData, OtpType } from 'src/email/interfaces';
import { RedisService } from 'src/redis/redis.service';
import { generateAndStoreOtp } from 'src/auth/utils';
import { createValidationError, decodeCompositeCursor, paginateComposite } from 'src/common/utils';
import { BlocksCursor, MutesCursor } from 'src/common/interfaces';
import { PAGINATION_ERROR_CODES, PAGINATION_ERROR_MESSAGES } from 'src/common/constants';

interface CachedEmailUpdateData {
  userId: string;
  otp: string;
  newEmail: string;
  username: string;
  currEmail: string;
  verified: boolean;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  async getUserDetails(userId: bigint) {
    return this.usersService.getUserDetails(userId);
  }

  async checkNewEmail(
    userId: bigint,
    inititateEmailUpdateDto: InititateEmailUpdateDto,
  ): Promise<{ confirmationToken: string }> {
    const { newEmail } = inititateEmailUpdateDto;

    const user = await this.usersService.findByEmail(newEmail);

    if (user) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.EMAIL_ALREADY_USED,
          code: USERS_ERROR_CODES.EMAIL_ALREADY_USED,
        },
        HttpStatus.CONFLICT,
      );
    }

    const confirmationToken = crypto.randomUUID();
    const redisKey = REDIS_KEYS.EMAIL_UPDATE(confirmationToken);
    const resendKey = REDIS_KEYS.OTP_RESEND_UPDATE_EMAIL(userId.toString());

    const currentUser = await this.usersService.findById(userId);

    if (!currentUser)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    const emailUpdateData: CachedEmailUpdateData = {
      newEmail,
      username: currentUser.username,
      currEmail: currentUser.email,
      userId: userId.toString(),
      otp: '',
      verified: false,
    };

    await generateAndStoreOtp(
      {
        redisKey,
        email: newEmail,
        resendKey,
        ttl: AUTH_CONFIG.EMAIL_UPDATE_TTL,
        data: emailUpdateData,
        emailQueue: this.emailQueue,
        otpType: OtpType.CHANGE_EMAIL,
      },
      this.redisService,
    );

    this.logger.log(`Email update initiated for ${currentUser?.email}`);
    return { confirmationToken };
  }

  async verifyEmailUpdate(
    userId: bigint,
    verifyEmailUpdateDto: VerifyEmailUpdateDto,
  ): Promise<{ message: string }> {
    const redisKey = REDIS_KEYS.EMAIL_UPDATE(verifyEmailUpdateDto.confirmationToken);
    const data = await this.redisService.get(redisKey);

    if (!data) {
      throw new BadRequestException(
        createValidationError('confirmationToken', {
          invalidToken: AUTH_ERROR_MESSAGES.INVALID_CONFIRMATION_TOKEN,
        }),
      );
    }

    const emailUpdateData = JSON.parse(data) as CachedEmailUpdateData;
    const isOtpValid = await bcrypt.compare(verifyEmailUpdateDto.otp, emailUpdateData.otp);

    if (!isOtpValid) {
      throw new BadRequestException(
        createValidationError('otp', {
          invalidToken: AUTH_ERROR_MESSAGES.OTP_INVALID,
        }),
      );
    }

    emailUpdateData.verified = true;

    await this.usersService.updateUserEmail(userId, emailUpdateData);

    await this.redisService.del(redisKey);
    await this.redisService.del(REDIS_KEYS.OTP_RESEND_UPDATE_EMAIL(userId.toString()));

    const jobData: EmailJobData = {
      email: emailUpdateData.newEmail,
      username: emailUpdateData.username,
      oldEmail: emailUpdateData.currEmail,
      type: OtpType.CHANGE_EMAIL_COMPLETE,
    };

    await this.emailQueue.add('sendEmailChange', jobData);

    this.logger.log(`Email update completed for ${emailUpdateData.newEmail}`);

    return { message: 'Email address updated successfully.' };
  }

  async resendEmailUpdateOtp(userId: bigint, resendEmailUpdateOtp: ResendEmailUpdateOtp) {
    const redisKey = REDIS_KEYS.EMAIL_UPDATE(resendEmailUpdateOtp.confirmationToken);

    const data = await this.redisService.get(redisKey);

    if (!data) {
      throw new BadRequestException(
        createValidationError('confirmationToken', {
          invalidToken: AUTH_ERROR_MESSAGES.INVALID_CONFIRMATION_TOKEN,
        }),
      );
    }

    const emailUpdateData = JSON.parse(data) as CachedEmailUpdateData;

    const resendKey = REDIS_KEYS.OTP_RESEND_UPDATE_EMAIL(userId.toString());

    emailUpdateData.otp = '';
    emailUpdateData.verified = false;

    await generateAndStoreOtp(
      {
        redisKey,
        email: emailUpdateData.newEmail,
        resendKey,
        ttl: AUTH_CONFIG.EMAIL_UPDATE_TTL,
        data: emailUpdateData,
        emailQueue: this.emailQueue,
        otpType: OtpType.CHANGE_EMAIL,
      },
      this.redisService,
    );

    this.logger.log(`Update email OTP for ${emailUpdateData.newEmail}`);
    return { message: 'OTP resent successfully.' };
  }

  async updateUsername(userId: bigint, updateUsernameDto: UpdateUsernameDto) {
    const res = await this.usersService.updateUsernameById(userId, updateUsernameDto.newUsername);

    this.logger.log(`Update username completed for ${updateUsernameDto.newUsername}`);

    return res;
  }

  async updateBirthDate(userId: bigint, birthDate: Date) {
    return this.usersService.updateBirthDate(userId, birthDate);
  }

  async getUserSSOs(userId: bigint) {
    return this.usersService.getUserSSOs(userId);
  }

  async removeUserSSO(userId: bigint, provider: string, currentPassword: string) {
    return this.usersService.removeUserSSO(userId, provider, currentPassword);
  }

  async getCountries() {
    return this.usersService.getCountries();
  }

  async changeCountry(userId: bigint, countryName: string) {
    return this.usersService.changeCountry(userId, countryName);
  }

  async updateGender(userId: bigint, gender: string) {
    return this.usersService.updateGender(userId, gender);
  }

  async updateLanguage(userId: bigint, gender: string) {
    return this.usersService.updateLanguage(userId, gender);
  }

  async validatePassword(userId: bigint, password: string) {
    const valid = await this.usersService.validateLoggedInUser(userId, password);

    if (valid) return { isValid: true };
    else
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.INVALID_PASSWORD,
          code: USERS_ERROR_CODES.INVALID_PASSWORD,
        },
        HttpStatus.FORBIDDEN,
      );
  }

  async getSessions(userId: bigint, refreshToken: string) {
    return this.usersService.getSessions(userId, refreshToken);
  }

  async deleteSession(userId: bigint, sessionId: bigint, refreshToken: string) {
    return this.usersService.deleteSession(userId, sessionId, refreshToken);
  }

  async getUserMutedUsers(userId: bigint, limit: number = 20, prevCursor?: string) {
    let decoded: MutesCursor | undefined;

    if (prevCursor) {
      try {
        decoded = decodeCompositeCursor<MutesCursor>(prevCursor);
      } catch {
        throw new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const mutedUsers = await this.usersService.getUserMutes(userId, limit + 1, decoded);

    const pagination = paginateComposite(mutedUsers, limit, prevCursor, (item) => ({
      userId: item.userId.toString(),
      mutedId: item.mutedId.toString(),
    }));

    const items = mutedUsers.map((b) => ({
      ...b.mutedUser.profile,
      username: b.mutedUser.username,
    }));

    return { items, pagination };
  }

  async getUserBlockedUsers(userId: bigint, limit: number = 20, prevCursor?: string) {
    let decoded: BlocksCursor | undefined;

    if (prevCursor) {
      try {
        decoded = decodeCompositeCursor<BlocksCursor>(prevCursor);
      } catch {
        throw new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const blockedUsers = await this.usersService.getUserBlocks(userId, limit + 1, decoded);

    const pagination = paginateComposite(blockedUsers, limit, prevCursor, (item) => ({
      userId: item.userId.toString(),
      blockedId: item.blockedId.toString(),
    }));

    const items = blockedUsers.map((b) => ({
      ...b.blockedUser.profile,
      username: b.blockedUser.username,
    }));

    return { items, pagination };
  }
}
