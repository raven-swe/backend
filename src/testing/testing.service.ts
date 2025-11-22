// src/test/test.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { REDIS_KEYS } from 'src/auth/constants/auth.constants';
import { RedisService } from 'src/redis/redis.service';
import { GetOtpDto, TestingOtpType } from './dtos/get-otp.dto';
import { UsersService } from 'src/users/users.service';
import { hashPassword } from 'src/auth/utils';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

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

  async createUser() {
    const maxAttempts = 10;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        const rand = crypto.randomBytes(4).toString('hex');
        const timestamp = Date.now();
        const username = `testuser_${rand}_${timestamp}`;
        const email = `test_${rand}_${timestamp}@example.com`;
        const displayName = `testuser_${rand}`;
        const password = `TestPass1_${crypto.randomBytes(8).toString('hex')}`;

        const passwordHash = await hashPassword(password);

        const user = await this.usersService.createUser({
          username,
          email,
          passwordHash,
          name: username,
          birthDate: new Date('2000-01-01'),
          languageCode: 'EN',
        });

        const userProfile = await this.usersService.createProfile(user.id, displayName);

        return {
          ...user,
          password,
          displayName: userProfile.displayName,
        };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          attempt++;
          continue;
        }

        throw error;
      }
    }

    throw new Error(
      `Failed to create user after ${maxAttempts} attempts due to duplicate constraints`,
    );
  }
}
