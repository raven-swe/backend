import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { OtpFailedException } from './exceptions/otp.exception';

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
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    @InjectQueue('email') private emailQueue: Queue,
    private readonly recaptchaService: RecaptchaService,
  ) {}

  async startRegistration(
    startRegistrationDto: StartRegistrationDto,
  ): Promise<{ creationToken: string }> {
    // logic to check existing user

    const creationToken: string = uuidv4();
    const otp = randomInt(100000, 999999).toString();
    const redisKey = `registration:${creationToken}`; // caching by token is easier, if user bails out and comes back a new token is issued
    const hashedOtp = await bcrypt.hash(otp, 10);

    const registrationData: CachedRegistrationData = {
      name: startRegistrationDto.name,
      email: startRegistrationDto.email,
      birthDate: startRegistrationDto.birthDate,
      otp: hashedOtp,
      verified: false,
    };
    await this.redisService.set(redisKey, JSON.stringify(registrationData), this.registrationTTL);
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
      throw new OtpFailedException('Invaid or expired OTP token');
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
      return { message: 'Invalid or expired token' };
    }
    const registrationData = JSON.parse(data) as CachedRegistrationData;
    if (!registrationData.verified) {
      throw new OtpFailedException('OTP not verified');
    }
    // proceed to create user in DB
    // const user = await this.userService.createUser({
    //   email: registrationData.email,
    //   name: registrationData.name,
    //   birthDate: registrationData.birthDate,
    //   password: completeRegistrationDto.password, // hash before saving
    // });
    await this.redisService.del(redisKey);
    this.logger.log(`Registration completed for ${registrationData.email}`);
    return { message: 'Registration completed successfully' };
  }

  async verifyRecaptcha(token: string): Promise<boolean> {
    const valid = await this.recaptchaService.validateToken(token);
    return !!valid;
  }
}
