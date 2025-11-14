export const AUTH_ERROR_CODES = {
  EMAIL_REGISTERED: 'EMAIL_REGISTERED',
  INVALID_CONFIRMATION_TOKEN: 'INVALID_CONFIRMATION_TOKEN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  OTP_INVALID: 'OTP_INVALID',
  OTP_NOT_VERIFIED: 'OTP_NOT_VERIFIED',
  OTP_RESEND_LIMIT_EXCEEDED: 'OTP_RESEND_LIMIT_EXCEEDED',
  BOTH_IDENTIFIERS_EMPTY: 'BOTH_IDENTIFIERS_EMPTY',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INVALID_PROVIDER: 'INVALID_PROVIDER',
} as const;

export const AUTH_ERROR_MESSAGES = {
  EMAIL_REGISTERED: 'Email is already registered',
  INVALID_CONFIRMATION_TOKEN: 'Invalid or expired confirmation token',
  USER_NOT_FOUND: 'User not found',
  OTP_INVALID: 'Invalid or expired OTP',
  OTP_NOT_VERIFIED: 'OTP not verified',
  OTP_RESEND_LIMIT_EXCEEDED: 'OTP resend limit reached. Please try again later.',
  BOTH_IDENTIFIERS_EMPTY: 'Email or username must be provided',
  INVALID_PASSWORD: 'Invalid password',
  INVALID_RECAPTCHA_TOKEN: 'The provided reCAPTCHA token is invalid or expired',
  INVALID_CREATION_TOKEN: 'Invalid or expired creation token',
  MISSING_CLIENT_TYPE_HEADER: 'X-Client-Type header is required',
  INVALID_CLIENT_TYPE_HEADER: 'X-Client-Type header is invalid',
  INVALID_PROVIDER: 'Only github and google are supported',
} as const;

export const REDIS_KEYS = {
  REGISTRATION: (token: string) => `registration:${token}`,
  OTP_RESEND: (email: string) => `otp_resend:${email}`,
  PASSWORD_RESET: (token: string) => `password_reset:${token}`,
  OTP_RESEND_PASSWORD_RESET: (email: string) => `otp_resend:password_reset:${email}`,
  EMAIL_UPDATE: (token: string) => `email_update:${token}`,
  OTP_RESEND_UPDATE_EMAIL: (userId: string) => `otp-resend:email_update:${userId}`,
} as const;

export const AUTH_CONFIG = {
  REGISTRATION_TTL: 300, // 5 minutes
  PASSWORD_RESET_TTL: 300,
  OTP_RESEND_LIMIT: 2,
  OTP_RESEND_WINDOW: 60, // 1 minute
  SALT_ROUNDS: 10, // for password hashing
  REFRESH_TOKEN_TTL: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  EMAIL_UPDATE_TTL: 300,
};
