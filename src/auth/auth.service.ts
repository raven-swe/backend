import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { DevicesService } from 'src/device/device.service';
import { RefreshTokensService } from 'src/refresh-tokens/refresh-tokens.service';
import { Device } from 'src/device/interfaces/device.interface';
import { RefreshToken } from 'src/refresh-tokens/interfaces/refresh-token.interface';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { LanguageCode } from '@prisma/client';
import { CachedRegistrationData } from './interfaces/CachedRegistrationData.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { NewUser } from 'src/users/interfaces/NewUser.interface';
import {
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_CODES,
  AUTH_CONFIG,
  REDIS_KEYS,
} from 'src/common/constants/auth.constants';
import { OtpType } from 'src/email/interfaces/email.interfaces';
import { generateAndStoreOtp } from './utils/otp.util';
import { hashPassword } from './utils/password.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly devicesService: DevicesService,
    private readonly refreshTokensService: RefreshTokensService,
    private readonly recaptchaService: RecaptchaService,
    private readonly prisma: PrismaService,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

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

    await generateAndStoreOtp(
      {
        redisKey,
        email: startRegistrationDto.email,
        resendKey,
        ttl: AUTH_CONFIG.REGISTRATION_TTL,
        data: registrationData,
        emailQueue: this.emailQueue,
        otpType: OtpType.REGISTRATION,
      },
      this.redisService,
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
          message: AUTH_ERROR_MESSAGES.INVALID_TOKEN,
          code: AUTH_ERROR_CODES.INVALID_TOKEN,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const registrationData = JSON.parse(data) as CachedRegistrationData;
    const otpValid = await bcrypt.compare(verifyOtpDto.otp, registrationData.otp);
    if (!otpValid) {
      throw new HttpException(
        {
          message: AUTH_ERROR_MESSAGES.OTP_INVALID,
          code: AUTH_ERROR_CODES.OTP_INVALID,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    registrationData.verified = true;
    await this.redisService.set(
      redisKey,
      JSON.stringify(registrationData),
      AUTH_CONFIG.REGISTRATION_TTL,
    );
    this.logger.log(`OTP verified for ${registrationData.email}`);
    return { message: 'OTP verified successfully' };
  }

  async completeRegistration(
    completeRegistrationDto: CompleteRegistrationDto,
    ipAddress: string | undefined,
  ): Promise<{ message: string; accessToken: string; refreshToken: string }> {
    const redisKey = REDIS_KEYS.REGISTRATION(completeRegistrationDto.creationToken);
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

    const registrationData = JSON.parse(data) as CachedRegistrationData;
    if (!registrationData.verified) {
      throw new HttpException(
        {
          message: AUTH_ERROR_MESSAGES.OTP_NOT_VERIFIED,
          code: AUTH_ERROR_CODES.OTP_NOT_VERIFIED,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const hashedPassword = await hashPassword(completeRegistrationDto.password);

    const userData = {
      email: registrationData.email,
      username: registrationData.email,
      name: registrationData.name,
      passwordHash: hashedPassword,
      birthDate: registrationData.birthDate,
      languageCode: LanguageCode.EN, //until we start user profiles
    };
    const randomToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(randomToken).digest('hex');
    const refreshToken: RefreshToken = {
      userId: BigInt(0), //placeholders to be set in transaction
      deviceId: BigInt(0),
      tokenHash: tokenHash,
      expiresAt: new Date(AUTH_CONFIG.REFRESH_TOKEN_TTL + Date.now()),
    };
    const newDevice: Device = {
      userId: BigInt(0),
      ipAddress: ipAddress || 'unknown',
      deviceType: completeRegistrationDto.deviceType,
    };
    const userId = await this.createUserAndDeviceAndToken(userData, newDevice, refreshToken);
    const accessToken = await this.generateAccessToken(userId);

    // clean up redis entry
    await this.redisService.del(redisKey);
    await this.redisService.del(`otp_resend:${registrationData.email}`);
    this.logger.log(`Registration completed for ${registrationData.email}`);
    return {
      message: 'Registration completed successfully',
      accessToken,
      refreshToken: randomToken,
    };
  }

  async resendOtp(creationToken: string): Promise<{ message: string }> {
    const redisKey = REDIS_KEYS.REGISTRATION(creationToken);
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

    const registrationData = JSON.parse(data) as CachedRegistrationData;
    const resendKey = REDIS_KEYS.OTP_RESEND(registrationData.email);

    await generateAndStoreOtp(
      {
        redisKey,
        email: registrationData.email,
        resendKey,
        ttl: AUTH_CONFIG.REGISTRATION_TTL,
        data: registrationData,
        emailQueue: this.emailQueue,
        otpType: OtpType.REGISTRATION,
      },
      this.redisService,
    );

    this.logger.log(`Resent OTP for ${registrationData.email}`);
    return { message: 'OTP resent successfully' };
  }

  async checkEmail(email: string): Promise<{ message: string; exists: boolean }> {
    const user = await this.usersService.findByEmail(email);
    return { message: user ? 'Email already exists' : 'Email is available', exists: !!user };
  }

  async generateAccessToken(userId: bigint): Promise<string> {
    const payload = { userId: userId.toString() };
    return this.jwtService.signAsync(payload);
  }

  async verifyRecaptcha(token: string): Promise<boolean> {
    const valid = await this.recaptchaService.validateToken(token);
    return !!valid;
  }

  //naming can be better ofc :)
  private async createUserAndDeviceAndToken(
    newUser: NewUser,
    newDevice: Device,
    refreshToken: RefreshToken,
  ): Promise<bigint> {
    return await this.prisma.$transaction(async (tx) => {
      const { id: userId } = await this.usersService.createUser(newUser, tx);
      this.logger.log(`User created with ID: ${userId}`);
      newDevice.userId = userId;

      await tx.profiles.create({
        data: { user_id: userId, display_name: newUser.name },
      });
      this.logger.log(`Profile created for user ID: ${userId} with display name: ${newUser.name}`);

      const { id: deviceId } = await this.devicesService.createDevice(newDevice, tx);
      this.logger.log(`Device created with ID: ${deviceId}`);

      refreshToken.userId = userId;
      refreshToken.deviceId = deviceId;
      await this.refreshTokensService.createRefreshToken(refreshToken, tx);
      this.logger.log(`Refresh token created for user ID: ${userId} and device ID: ${deviceId}`);

      return userId;
    });
  }
}
