import { HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_CODES,
  AUTH_CONFIG,
} from 'src/auth/constants/auth.constants';

import { RedisService } from 'src/redis/redis.service';
import { Queue } from 'bullmq';
import { OtpType, EmailJobData } from 'src/email/interfaces/email.interfaces';

interface GenerateAndStoreOtpParams<T extends { otp: string; verified: boolean }> {
  redisKey: string;
  email: string;
  resendKey: string;
  ttl: number;
  data: Omit<T, 'otp' | 'verified'>;
  emailQueue: Queue;
  otpType: OtpType;
  username?: string; // Optional, only for forget password
}

/**
 * Generates OTP, hashes it, stores to Redis, and sends via email
 * Includes rate limiting for OTP resend attempts
 *
 * @throws LimitExceeded exception if number of attempts exceeds otp resend limit and returns retryAfter in seconds
 */
export async function generateAndStoreOtp<T extends { otp: string; verified: boolean }>(
  params: GenerateAndStoreOtpParams<T>,
  redisService: RedisService,
): Promise<string> {
  const { redisKey, email, resendKey, ttl, data, emailQueue, otpType, username } = params;

  // Track resend attempts to rate-limit
  const attempts = await redisService.get(resendKey);

  if (attempts && parseInt(attempts) >= AUTH_CONFIG.OTP_RESEND_LIMIT) {
    const remainingTTL = await redisService.ttl(resendKey);
    throw new HttpException(
      {
        message: AUTH_ERROR_MESSAGES.OTP_RESEND_LIMIT_EXCEEDED,
        code: AUTH_ERROR_CODES.OTP_RESEND_LIMIT_EXCEEDED,
        retryAfter: remainingTTL, // in seconds
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

  const newAttempts = await redisService.incr(resendKey);

  // Set expiration only if it's new
  if (newAttempts === 1) {
    await redisService.expire(resendKey, AUTH_CONFIG.OTP_RESEND_WINDOW);
  }

  // Send the otp to the user with type
  // Note: This function is only called for REGISTRATION, FORGOT_PASSWORD, and CHANGE_EMAIL
  let jobData: EmailJobData;

  if (otpType === OtpType.FORGOT_PASSWORD) {
    jobData = {
      type: OtpType.FORGOT_PASSWORD,
      email,
      otp,
      username: username || '',
    };
  } else {
    // REGISTRATION or CHANGE_EMAIL
    jobData = {
      type: otpType as OtpType.REGISTRATION | OtpType.CHANGE_EMAIL,
      email,
      otp,
    };
  }

  await emailQueue.add('sendOtp', jobData);

  return otp;
}
