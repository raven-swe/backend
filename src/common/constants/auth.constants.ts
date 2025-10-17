export const AUTH_ERROR_CODES = {
  EMAIL_REGISTERED: 'EMAIL_REGISTERED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  OTP_INVALID: 'OTP_INVALID',
  OTP_NOT_VERIFIED: 'OTP_NOT_VERIFIED',
  OTP_RESEND_LIMIT_EXCEEDED: 'OTP_RESEND_LIMIT_EXCEEDED',
  BOTH_IDENTIFIERS_EMPTY: 'BOTH_IDENTIFIERS_EMPTY',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
} as const;

export const AUTH_ERROR_MESSAGES = {
  EMAIL_REGISTERED: 'Email is already registered',
  INVALID_TOKEN: 'Invalid or expired token',
  USER_NOT_FOUND: 'User not found',
  OTP_INVALID: 'Invalid or expired OTP',
  OTP_NOT_VERIFIED: 'OTP not verified',
  OTP_RESEND_LIMIT_EXCEEDED: 'OTP resend limit reached. Please try again later.',
  BOTH_IDENTIFIERS_EMPTY: 'Email or username must be provided',
  INVALID_PASSWORD: 'Invalid password',
} as const;
