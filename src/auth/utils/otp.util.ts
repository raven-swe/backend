import { HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_CODES,
  AUTH_CONFIG,
} from 'src/common/constants/auth.constants';
import { RedisService } from 'src/redis/redis.service';
import { Queue } from 'bullmq';

interface GenerateAndStoreOtpParams<T extends { otp: string; verified: boolean }> {
  redisKey: string;
  email: string;
  resendKey: string;
  ttl: number;
  data: Omit<T, 'otp' | 'verified'>;
  emailQueue: Queue;
}

/**
 * Generates OTP, hashes it, stores to Redis, and sends via email
 * Includes rate limiting for OTP resend attempts
 *
 * @throws LimitExceeded exception if number of attempts exceeds otp resend limit
 */
export async function generateAndStoreOtp<T extends { otp: string; verified: boolean }>(
  params: GenerateAndStoreOtpParams<T>,
  redisService: RedisService,
): Promise<string> {
  const { redisKey, email, resendKey, ttl, data, emailQueue } = params;

  // Track resend attempts to rate-limit
  const attempts = await redisService.get(resendKey);

  if (attempts && parseInt(attempts) >= AUTH_CONFIG.OTP_RESEND_LIMIT) {
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
  await redisService.set(redisKey, JSON.stringify(dataWithOtp), ttl);
  await redisService.set(
    resendKey,
    String((Number(attempts) || 0) + 1),
    AUTH_CONFIG.OTP_RESEND_WINDOW,
  );

  // Send the otp to the user
  await emailQueue.add('sendOtp', {
    email,
    otp,
  });

  return otp;
}
