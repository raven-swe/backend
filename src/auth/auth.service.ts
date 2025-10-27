import {
  HttpException,
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
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
import { LanguageCode } from '@prisma/client';
import {
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_CODES,
  REDIS_KEYS,
  AUTH_CONFIG,
} from 'src/auth/constants/auth.constants';
import { VerifyForgotPasswordDto } from './dto/verify-forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { hashPassword } from './utils/password.util';
import { ResendPasswordOtpDto } from './dto/resend-password-otp.dto';
import { generateAndStoreOtp } from './utils/otp.util';
import { DevicesService } from 'src/devices/devices.service';
import { OtpType } from 'src/email/interfaces/email.interfaces';
import { RefreshTokensService } from 'src/refresh-tokens/refresh-tokens.service';
import { Device, DeviceType } from 'src/devices/interfaces/device.interface';
import { RefreshToken } from 'src/refresh-tokens/interfaces/refresh-token.interface';
import { CachedRegistrationData } from './interfaces/CachedRegistrationData.interface';
import { NewUser } from 'src/users/interfaces/NewUser.interface';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { CachedPasswordResetData } from './interfaces/CachedPasswordResetData.interface';
import type { RequestUser } from './types';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

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
    private readonly config: ConfigService,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  async startRegistration(
    startRegistrationDto: StartRegistrationDto,
  ): Promise<{ creationToken: string }> {
    const valid = await this.verifyRecaptcha(startRegistrationDto.recaptchaToken);
    if (!valid) {
      throw new BadRequestException(
        createValidationError('recaptchaToken', {
          invalidToken: AUTH_ERROR_MESSAGES.INVALID_RECAPTCHA_TOKEN,
        }),
      );
    }

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
    this.logger.log(`Verifying OTP for creation token ${verifyOtpDto.creationToken}`);
    if (!data) {
      throw new BadRequestException(
        createValidationError('creationToken', {
          invalidToken: AUTH_ERROR_MESSAGES.INVALID_CREATION_TOKEN,
        }),
      );
    }

    const registrationData = JSON.parse(data) as CachedRegistrationData;
    const otpValid = await bcrypt.compare(verifyOtpDto.otp, registrationData.otp);
    if (!otpValid) {
      throw new BadRequestException(
        createValidationError('otp', {
          invalidToken: AUTH_ERROR_MESSAGES.OTP_INVALID,
        }),
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
    clientType: string,
  ): Promise<{ message: string; accessToken: string; refreshToken: string }> {
    const redisKey = REDIS_KEYS.REGISTRATION(completeRegistrationDto.creationToken);
    const data = await this.redisService.get(redisKey);
    if (!data) {
      throw new BadRequestException(
        createValidationError('creationToken', {
          invalidToken: AUTH_ERROR_MESSAGES.INVALID_CREATION_TOKEN,
        }),
      );
    }

    this.validateDeviceType(clientType);

    const registrationData = JSON.parse(data) as CachedRegistrationData;
    if (!registrationData.verified) {
      throw new BadRequestException(
        createValidationError('otp', {
          invalidToken: AUTH_ERROR_MESSAGES.OTP_NOT_VERIFIED,
        }),
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
      deviceType: clientType as DeviceType,
    };
    const userId = await this.createUserAndDeviceAndToken(userData, newDevice, refreshToken);
    const accessToken = await this.jwtService.signAsync({ id: userId.toString() });

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
      throw new BadRequestException(
        createValidationError('creationToken', {
          invalidToken: AUTH_ERROR_MESSAGES.INVALID_CREATION_TOKEN,
        }),
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

  async verifyRecaptcha(token: string): Promise<boolean> {
    const valid = await this.recaptchaService.validateToken(token);

    return !!valid;
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ confirmationToken: string; message: string }> {
    const { identifier } = forgotPasswordDto;

    // Verify recaptcha
    const isValid = await this.verifyRecaptcha(forgotPasswordDto.recaptchaToken);
    if (!isValid) {
      throw new BadRequestException(
        createValidationError('recaptchaToken', {
          invalidToken: AUTH_ERROR_MESSAGES.INVALID_RECAPTCHA_TOKEN,
        }),
      );
    }

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

    await generateAndStoreOtp(
      {
        redisKey,
        email: user.email,
        resendKey,
        ttl: AUTH_CONFIG.PASSWORD_RESET_TTL,
        data: passwordResetData,
        emailQueue: this.emailQueue,
        otpType: OtpType.FORGOT_PASSWORD,
      },
      this.redisService,
    );

    this.logger.log(`Password reset initiated for ${user.email}`);
    return { confirmationToken, message: 'Password reset code sent to email' };
  }

  async verifyForgotPassword(
    verifyForgotPassword: VerifyForgotPasswordDto,
  ): Promise<{ message: string }> {
    const redisKey = REDIS_KEYS.PASSWORD_RESET(verifyForgotPassword.confirmationToken);
    const data = await this.redisService.get(redisKey);

    if (!data) {
      throw new BadRequestException(
        createValidationError('confirmationToken', {
          invalidToken: AUTH_ERROR_MESSAGES.INVALID_CONFIRMATION_TOKEN,
        }),
      );
    }

    // Compare incoming otp with the stored otp
    const passwordResetData = JSON.parse(data) as CachedPasswordResetData;
    const isOtpValid = await bcrypt.compare(verifyForgotPassword.otp, passwordResetData.otp);

    if (!isOtpValid) {
      throw new BadRequestException(
        createValidationError('otp', {
          invalidToken: AUTH_ERROR_MESSAGES.OTP_INVALID,
        }),
      );
    }

    // Verify otp
    passwordResetData.verified = true;
    await this.redisService.set(
      redisKey,
      JSON.stringify(passwordResetData),
      AUTH_CONFIG.PASSWORD_RESET_TTL,
    );
    this.logger.log(`Password reset OTP verified for ${passwordResetData.email}`);

    return { message: 'Password reset verified successfully.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const redisKey = REDIS_KEYS.PASSWORD_RESET(resetPasswordDto.confirmationToken);
    const data = await this.redisService.get(redisKey);

    if (!data) {
      throw new BadRequestException(
        createValidationError('confirmationToken', {
          invalidToken: AUTH_ERROR_MESSAGES.INVALID_CONFIRMATION_TOKEN,
        }),
      );
    }

    // Check if user's data is verified or not
    const passwordResetData = JSON.parse(data) as CachedPasswordResetData;
    if (!passwordResetData.verified) {
      throw new BadRequestException(
        createValidationError('otp', {
          invalidToken: AUTH_ERROR_MESSAGES.OTP_NOT_VERIFIED,
        }),
      );
    }

    // Update user with new password
    const userId = BigInt(passwordResetData.userId);
    const hashedPassword = await hashPassword(resetPasswordDto.newPassword);
    await this.usersService.updatePasswordById(userId, hashedPassword);

    // Remove all devices/sessions for this user
    await this.devicesService.removeAllUserDevices(userId);
    this.logger.log(`Logged out user ${userId} from all devices after password reset`);

    // Clean up redis entries
    await this.redisService.del(redisKey);
    await this.redisService.del(REDIS_KEYS.OTP_RESEND_PASSWORD_RESET(passwordResetData.email));

    this.logger.log(`Password reset completed for ${passwordResetData.email}`);
    return { message: 'Password has been reset successfully.' };
  }

  async resendPasswordOtp(
    resendPasswordOtpDto: ResendPasswordOtpDto,
  ): Promise<{ message: string }> {
    const redisKey = REDIS_KEYS.PASSWORD_RESET(resendPasswordOtpDto.confirmationToken);
    const data = await this.redisService.get(redisKey);

    if (!data) {
      throw new BadRequestException(
        createValidationError('confirmationToken', {
          invalidToken: AUTH_ERROR_MESSAGES.INVALID_CONFIRMATION_TOKEN,
        }),
      );
    }

    const passwordResetData = JSON.parse(data) as CachedPasswordResetData;
    const resendKey = REDIS_KEYS.OTP_RESEND_PASSWORD_RESET(passwordResetData.email);

    // Reset OTP and verified state before generating a new one
    passwordResetData.otp = '';
    passwordResetData.verified = false;

    await generateAndStoreOtp(
      {
        redisKey,
        email: passwordResetData.email,
        resendKey,
        ttl: AUTH_CONFIG.PASSWORD_RESET_TTL,
        data: passwordResetData,
        emailQueue: this.emailQueue,
        otpType: OtpType.FORGOT_PASSWORD,
      },
      this.redisService,
    );

    this.logger.log(`Resent password reset OTP for ${passwordResetData.email}`);
    return { message: 'OTP resent successfully.' };
  }

  validateDeviceType(clientType: string): void {
    if (!clientType) {
      throw new BadRequestException(
        createValidationError('X-Client-Type', {
          missingHeader: AUTH_ERROR_MESSAGES.MISSING_CLIENT_TYPE_HEADER,
        }),
      );
    }
    const upper = clientType.toUpperCase();
    if (!(upper in DeviceType)) {
      throw new BadRequestException(
        createValidationError('X-Client-Type', {
          invalidValue: AUTH_ERROR_MESSAGES.INVALID_CLIENT_TYPE_HEADER,
        }),
      );
    }
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

  async validateUser(identifier: string, password: string): Promise<RequestUser | null> {
    const user = await this.prisma.users.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }, { phone: identifier }],
      },
    });

    if (user && user.password_hash) {
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (isMatch) {
        return { id: user.id.toString() };
      }
    }
    return null;
  }

  async login(user: RequestUser, deviceType: string, ipAddress: string) {
    const accessToken = await this.jwtService.signAsync({ id: user.id });

    const refreshTokenExpiresIn = parseInt(
      this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN_DAYS') || '30',
      10,
    );
    const { refreshToken, hashedRefreshToken, expiresAt } =
      this.generateRefreshTokenWithExpiry(refreshTokenExpiresIn);

    await this.prisma.$transaction(async (tx) => {
      const userDevice = await tx.user_devices.create({
        data: {
          user_id: BigInt(user.id),
          device_type: deviceType,
          ip_address: ipAddress,
        },
      });

      await tx.refresh_tokens.create({
        data: {
          user_id: BigInt(user.id),
          device_id: userDevice.id,
          token_hash: hashedRefreshToken,
          expires_at: expiresAt,
        },
      });
    });
    return {
      accessToken,
      refreshToken,
    };
  }

  async checkIdentifier(identifier: string) {
    const user = await this.prisma.users.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }, { phone: identifier }],
      },
    });

    if (user) {
      return {
        exists: true,
        type:
          identifier === user.username ? 'username' : identifier === user.email ? 'email' : 'phone',
      };
    }
    return { exists: false };
  }
  private generateRefreshTokenWithExpiry(expiryInDays: number) {
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    const hashedRefreshToken = this.hashStringDeterministic(refreshToken);
    expiresAt.setDate(expiresAt.getDate() + expiryInDays);
    return { refreshToken, hashedRefreshToken, expiresAt };
  }

  private hashStringDeterministic(str: string) {
    const hash = crypto.createHash('sha256');
    hash.update(str);
    return hash.digest('hex');
  }

  private async getTokenByHash(hash: string) {
    return await this.prisma.refresh_tokens.findUnique({
      where: {
        token_hash: hash,
      },
      include: {
        user: { select: { id: true, username: true } },
      },
    });
  }

  async refreshAccessToken(refreshToken: string) {
    const hashedRefreshToken = this.hashStringDeterministic(refreshToken);
    const oldToken = await this.getTokenByHash(hashedRefreshToken);

    if (!oldToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (oldToken.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user: RequestUser = { id: oldToken.user.id.toString() };
    const accessToken = await this.jwtService.signAsync({ id: user.id });
    const refreshTokenExpiresIn = parseInt(
      this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN_DAYS') || '30',
      10,
    );
    const {
      refreshToken: newRefreshToken,
      hashedRefreshToken: newHashedRefreshToken,
      expiresAt,
    } = this.generateRefreshTokenWithExpiry(refreshTokenExpiresIn);

    await this.prisma.refresh_tokens.update({
      where: { id: BigInt(oldToken.id) },
      data: { token_hash: newHashedRefreshToken, expires_at: expiresAt },
    });
    return { refreshToken: newRefreshToken, accessToken };
  }

  async clearRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = this.hashStringDeterministic(refreshToken);
    const token = await this.getTokenByHash(hashedRefreshToken);
    if (token) {
      await this.prisma.$transaction([
        this.prisma.refresh_tokens.delete({
          where: { id: BigInt(token.id), user_id: BigInt(userId) },
        }),
        this.prisma.user_devices.delete({ where: { id: BigInt(token.device_id) } }),
      ]);
    }
  }
}
