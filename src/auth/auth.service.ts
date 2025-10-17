import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { OtpFailedException } from './exceptions/otp.exception';
import { LanguageCode } from '@prisma/client';

interface CachedRegistrationData {
  email: string;
  name: string;
  birthDate: Date;
  otp: string;
  verified: boolean; // otp state
}

@Injectable()
export class AuthService {
  private readonly registrationTTL = 300; // 5 minutes
  private readonly otpResendLimit = 3;
  private readonly otpResendWindow = 600; // 10 minutes
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    @InjectQueue('email') private emailQueue: Queue,
    private readonly recaptchaService: RecaptchaService,
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

    const creationToken: string = uuidv4();
    const otp = crypto.randomInt(100000, 999999).toString();
    const redisKey = `registration:${creationToken}`; // caching by token is easier, if user bails out and comes back a new token is issued
    const resendKey = `otp_resend:${startRegistrationDto.email}`; // for rate-limiting by email, should be used whenever resending OTP is implemented
    const attempts = await this.redisService.get(resendKey);
    if (attempts && parseInt(attempts) >= this.otpResendLimit) {
      throw new HttpException(
        'OTP resend limit reached. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const hashedOtp = await bcrypt.hash(otp, 10);

    const registrationData: CachedRegistrationData = {
      name: startRegistrationDto.name,
      email: startRegistrationDto.email,
      birthDate: startRegistrationDto.birthDate,
      otp: hashedOtp,
      verified: false,
    };

    await this.redisService.set(redisKey, JSON.stringify(registrationData), this.registrationTTL);
    await this.redisService.set(
      resendKey,
      String((Number(attempts) || 0) + 1),
      this.otpResendWindow,
    );

    await this.emailQueue.add('sendOtp', {
      email: startRegistrationDto.email,
      otp: otp,
    });
    this.logger.log(`Started registration for ${startRegistrationDto.email}`);
    return { creationToken };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{ message: string }> {
    const redisKey = `registration:${verifyOtpDto.creationToken}`;
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
    const redisKey = `registration:${completeRegistrationDto.creationToken}`;
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
      password: completeRegistrationDto.password,
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
    const redisKey = `registration:${creationToken}`;
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
}
