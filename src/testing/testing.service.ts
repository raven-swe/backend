// src/test/test.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { REDIS_KEYS } from 'src/auth/constants/auth.constants';
import { RedisService } from 'src/redis/redis.service';
import { GetOtpDto, TestingOtpType } from './dtos/get-otp.dto';
import { UsersService } from 'src/users/users.service';
import { hashPassword } from 'src/auth/utils';

@Injectable()
export class TestService {
  constructor(
    private readonly redisService: RedisService,
    private readonly usersService: UsersService,
  ) {}

  async getOtp(getOtpDto: GetOtpDto): Promise<{ otp: string }> {
    const { type, identifier } = getOtpDto;

    // reconstructs resend key sent in generateAndStoreOtp
    let resendKey: string;
    switch (type) {
      case TestingOtpType.REGISTRATION:
        resendKey = REDIS_KEYS.OTP_RESEND(identifier); // identifier is email
        break;
      case TestingOtpType.FORGOT_PASSWORD:
        resendKey = REDIS_KEYS.OTP_RESEND_PASSWORD_RESET(identifier); // identifier is email
        break;
      case TestingOtpType.CHANGE_EMAIL:
        resendKey = REDIS_KEYS.OTP_RESEND_UPDATE_EMAIL(identifier); // identifier is userId
        break;
      default:
        throw new NotFoundException('Unsupported OTP type for testing.');
    }

    const testOtpKey = `test_otp:${resendKey}`;
    const otp = await this.redisService.get(testOtpKey);

    if (!otp) {
      throw new NotFoundException(
        `No OTP found for the given identifier and type, it probably expired.`,
      );
    }

    return { otp };
  }

  async createUser(username: string, email: string, password: string) {
    // Implementation for creating a user for testing purposes and return it for testers to use it
    const passwordHash = await hashPassword(password);

    return this.usersService.createUser({
      username,
      email,
      passwordHash,
      name: username,
      birthDate: new Date('2000-01-01'),
      languageCode: 'EN',
    });
  }
}
