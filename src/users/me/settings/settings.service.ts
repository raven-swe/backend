import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants/users.constants';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InititateEmailUpdateDto } from 'src/users/dtos/initiate-email-update.dto';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';
import {
  AUTH_CONFIG,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  REDIS_KEYS,
} from 'src/common/constants/auth.constants';
import { EmailJobData, OtpType } from 'src/email/interfaces/email.interfaces';
import { RedisService } from 'src/redis/redis.service';
import { generateAndStoreOtp } from 'src/auth/utils/otp.util';
import { VerifyEmailUpdateDto } from 'src/users/dtos/verify-email-update.dto';
import { OtpFailedException } from 'src/auth/exceptions/otp.exception';
import { ResendEmailUpdateOtp } from 'src/users/dtos/resend-email-update-otp.dto';

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
      throw new HttpException(
        {
          message: AUTH_ERROR_MESSAGES.INVALID_TOKEN,
          code: AUTH_ERROR_CODES.INVALID_TOKEN,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const emailUpdateData = JSON.parse(data) as CachedEmailUpdateData;
    const isOtpValid = await bcrypt.compare(verifyEmailUpdateDto.otp, emailUpdateData.otp);

    if (!isOtpValid) {
      throw new OtpFailedException(AUTH_ERROR_MESSAGES.OTP_INVALID);
    }

    emailUpdateData.verified = true;

    await this.usersService.updateUserEmail(userId, emailUpdateData);

    await this.redisService.del(redisKey);
    await this.redisService.del(REDIS_KEYS.OTP_RESEND_UPDATE_EMAIL(emailUpdateData.newEmail));

    const jobData: EmailJobData = {
      email: emailUpdateData.newEmail,
      username: emailUpdateData.username,
      oldEmail: emailUpdateData.currEmail,
      type: OtpType.CHANGE_EMAIL_COMPLETE,
    };

    await this.emailQueue.add('sendEmailChange', jobData);

    this.logger.log(`Password reset completed for ${emailUpdateData.newEmail}`);

    return { message: 'Email address updated successfully.' };
  }

  async resendEmailUpdateOtp(userId: bigint, resendEmailUpdateOtp: ResendEmailUpdateOtp) {
    const redisKey = REDIS_KEYS.EMAIL_UPDATE(resendEmailUpdateOtp.confirmationToken);

    const data = await this.redisService.get(redisKey);

    if (!data) {
      throw new HttpException(
        {
          message: AUTH_ERROR_MESSAGES.INVALID_TOKEN,
          code: AUTH_ERROR_CODES.INVALID_TOKEN,
        },
        HttpStatus.BAD_REQUEST,
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
}
