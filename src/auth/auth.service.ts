import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { OtpFailedException } from './exceptions/otp.exception';
import { LanguageCode } from '@prisma/client';
import {
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_CODES,
  REDIS_KEYS,
} from 'src/common/constants/auth.constants';
import { VerifyForgotPasswordDto } from './dto/verify-forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { hashPassword } from './utils/password.util';

interface CachedRegistrationData {
  email: string;
  name: string;
  birthDate: Date;
  otp: string;
  verified: boolean; // otp state
}

interface CachedPasswordResetData {
  email: string;
  userId: string;
  otp: string;
  verified: boolean;
}

@Injectable()
export class AuthService {
  private readonly registrationTTL = 300; // 5 minutes
  private readonly passwordResetTTL = 300;
  private readonly otpResendLimit = 5;
  private readonly otpResendWindow = 600; // 10 minutes
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    @InjectQueue('email') private emailQueue: Queue,
    private readonly recaptchaService: RecaptchaService,
  ) {}

  private async generateAndSendOtp<T extends { otp: string; verified: boolean }>(
    redisKey: string,
    email: string,
    resendKey: string,
    ttl: number,
    data: Omit<T, 'otp' | 'verified'>,
  ): Promise<string> {
    // Track resend attempts to rate-limit
    const attempts = await this.redisService.get(resendKey);

    if (attempts && parseInt(attempts) >= this.otpResendLimit) {
      throw new HttpException(
        {
          message: AUTH_ERROR_MESSAGES.OTP_RESEND_LIMIT_EXCEEDED,
          code: AUTH_ERROR_CODES.OTP_RESEND_LIMIT_EXCEEDED,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate and hash a random otp
    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    const dataWithOtp: T = {
      ...data,
      otp: hashedOtp,
      verified: false,
    } as T;

    // Save to redis and increase number of attempts
    await this.redisService.set(redisKey, JSON.stringify(dataWithOtp), ttl);
    await this.redisService.set(
      resendKey,
      String((Number(attempts) || 0) + 1),
      this.otpResendWindow,
    );

    // Send the otp to the user
    await this.emailQueue.add('sendOtp', {
      email,
      otp,
    });

    return otp;
  }

  async startRegistration(
    startRegistrationDto: StartRegistrationDto,
  ): Promise<{ creationToken: string }> {
    const existingUser = await this.usersService.findByEmail(startRegistrationDto.email);
    if (existingUser) {
      throw new HttpException(
        {
          message: 'Email is already registered',
          code: 'EMAIL_REGISTERED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const creationToken: string = crypto.randomUUID();
    const redisKey = REDIS_KEYS.REGISTRATION(creationToken); // caching by token is easier, if user bails out and comes back a new token is issued
    const resendKey = REDIS_KEYS.OTP_RESEND(startRegistrationDto.email); // for rate-limiting by email, should be used whenever resending OTP is implemented

    const registrationData: CachedRegistrationData = {
      name: startRegistrationDto.name,
      email: startRegistrationDto.email,
      birthDate: startRegistrationDto.birthDate,
      otp: '',
      verified: false,
    };

    await this.generateAndSendOtp(
      redisKey,
      startRegistrationDto.email,
      resendKey,
      this.registrationTTL,
      registrationData,
    );

    this.logger.log(`Started registration for ${startRegistrationDto.email}`);
    return { creationToken };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{ message: string }> {
    const redisKey = REDIS_KEYS.REGISTRATION(verifyOtpDto.creationToken);
    const data = await this.redisService.get(redisKey);
    if (!data) {
      throw new HttpException(
        {
          message: 'Invalid or expired creation token',
          code: 'INVALID_TOKEN',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const registrationData = JSON.parse(data) as CachedRegistrationData;
    const otpValid = await bcrypt.compare(verifyOtpDto.otp, registrationData.otp);
    if (!otpValid) {
      throw new OtpFailedException('Invalid or expired OTP token');
    }

    registrationData.verified = true;
    await this.redisService.set(redisKey, JSON.stringify(registrationData), this.registrationTTL);
    this.logger.log(`OTP verified for ${registrationData.email}`);
    return { message: 'OTP verified successfully' };
  }

  async completeRegistration(completeRegistrationDto: CompleteRegistrationDto) {
    const redisKey = REDIS_KEYS.REGISTRATION(completeRegistrationDto.creationToken);
    const data = await this.redisService.get(redisKey);
    if (!data) {
      throw new OtpFailedException('Invaid or expired OTP token');
    }

    const registrationData = JSON.parse(data) as CachedRegistrationData;
    if (!registrationData.verified) {
      throw new OtpFailedException('OTP not verified');
    }

    const userData = {
      email: registrationData.email,
      username: registrationData.email,
      password: await hashPassword(completeRegistrationDto.password),
      birthDate: registrationData.birthDate,
      languageCode: LanguageCode.EN, //until we start user profiles
    };

    const user = await this.usersService.createUser(userData);
    const accessToken = await this.generateAccessToken(user.id);
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    // clean up redis entry
    await this.redisService.del(redisKey);
    await this.redisService.del(`otp_resend:${registrationData.email}`);
    this.logger.log(`Registration completed for ${registrationData.email}`);
    return {
      message: 'Registration completed successfully',
      accessToken,
      refreshToken: refreshTokenHash,
    };
  }

  async resendOtp(creationToken: string): Promise<{ message: string }> {
    const redisKey = REDIS_KEYS.REGISTRATION(creationToken);
    const data = await this.redisService.get(redisKey);
    if (!data) {
      throw new HttpException(
        {
          message: 'Invalid or expired creation token',
          code: 'INVALID_TOKEN',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const registrationData = JSON.parse(data) as CachedRegistrationData;
    const resendKey = `otp_resend:${registrationData.email}`;
    const attempts = await this.redisService.get(resendKey);
    if (attempts && parseInt(attempts) >= this.otpResendLimit) {
      throw new HttpException(
        'OTP resend limit reached. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    registrationData.otp = hashedOtp;

    await this.redisService.set(redisKey, JSON.stringify(registrationData), this.registrationTTL);
    await this.redisService.set(
      resendKey,
      String((Number(attempts) || 0) + 1),
      this.otpResendWindow,
    );

    await this.emailQueue.add('sendOtp', {
      email: registrationData.email,
      otp: otp,
    });
    this.logger.log(`Resent OTP for ${registrationData.email}`);
    return { message: 'OTP resent successfully' };
  }

  async checkEmail(email: string): Promise<{ message: string; exists: boolean }> {
    const user = await this.usersService.findByEmail(email);
    return { message: 'email already exists', exists: !!user };
  }

  async generateAccessToken(userId: bigint): Promise<string> {
    const payload = { userId: userId.toString() };
    return this.jwtService.signAsync(payload);
  }

  async verifyRecaptcha(token: string): Promise<boolean> {
    const valid = await this.recaptchaService.validateToken(token);
    return !!valid;
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ confirmationToken: string }> {
    const { identifier } = forgotPasswordDto;

    // Find user email or username
    const user = await this.usersService.findByIdentifier(identifier);
    if (!user) {
      throw new HttpException(
        {
          message: AUTH_ERROR_MESSAGES.USER_NOT_FOUND,
          code: AUTH_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Generate otp and store to redis
    const confirmationToken = crypto.randomUUID();
    const redisKey = REDIS_KEYS.PASSWORD_RESET(confirmationToken);
    const resendKey = REDIS_KEYS.OTP_RESEND_PASSWORD_RESET(user.email);

    const passwordResetData: CachedPasswordResetData = {
      email: user.email,
      userId: user.id.toString(),
      otp: '',
      verified: false,
    };

    await this.generateAndSendOtp(
      redisKey,
      user.email,
      resendKey,
      this.passwordResetTTL,
      passwordResetData,
    );

    this.logger.log(`Password reset initiated for ${user.email}`);
    return { confirmationToken };
  }

  async verifyForgotPassword(
    verifyForgotPassword: VerifyForgotPasswordDto,
  ): Promise<{ message: string }> {
    const redisKey = REDIS_KEYS.PASSWORD_RESET(verifyForgotPassword.confirmationToken);
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

    // Compare incoming otp with the stored otp
    const passwordResetData = JSON.parse(data) as CachedPasswordResetData;
    const isOtpValid = await bcrypt.compare(verifyForgotPassword.otp, passwordResetData.otp);

    if (!isOtpValid) {
      throw new OtpFailedException(AUTH_ERROR_MESSAGES.OTP_INVALID);
    }

    // Verify otp
    passwordResetData.verified = true;
    await this.redisService.set(redisKey, JSON.stringify(passwordResetData), this.passwordResetTTL);
    this.logger.log(`Password reset OTP verified for ${passwordResetData.email}`);

    return { message: 'Password reset verified successfully.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const redisKey = REDIS_KEYS.PASSWORD_RESET(resetPasswordDto.confirmationToken);
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

    // Check if user's data is verified or not
    const passwordResetData = JSON.parse(data) as CachedPasswordResetData;
    if (!passwordResetData.verified) {
      throw new OtpFailedException(AUTH_ERROR_MESSAGES.OTP_NOT_VERIFIED);
    }

    // Update user with his new password
    const userId = BigInt(passwordResetData.userId);
    const hashedPassword = await hashPassword(resetPasswordDto.newPassword);
    await this.usersService.updatePassword(userId, hashedPassword);

    // Delete redis reset password keys
    await this.redisService.del(redisKey);
    await this.redisService.del(REDIS_KEYS.OTP_RESEND_PASSWORD_RESET(passwordResetData.email));

    this.logger.log(`Password reset completed for ${passwordResetData.email}`);
    return { message: 'Password reset successfully.' };
  }
}
