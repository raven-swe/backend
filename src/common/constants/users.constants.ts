export const USERS_ERROR_CODES = {
  INVALID_OLD_PASSWORD: 'INVALID_OLD_PASSWORD',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  NEW_PASSWORD_SAME_AS_OLD: 'NEW_PASSWORD_SAME_AS_OLD',
  PASSWORD_NOT_SET: 'PASSWORD_NOT_SET',
  INVALID_PASSWORD_FORMAT: 'INVALID_PASSWORD_FORMAT',
  PASSWORD_CHANGE_LIMIT_EXCEEDED: 'Too many password change attempts. Please try again later.',
} as const;

export const USERS_ERROR_MESSAGES = {
  INVALID_OLD_PASSWORD: 'The old password provided is incorrect',
  USER_NOT_FOUND: 'User not found',
  NEW_PASSWORD_SAME_AS_OLD: 'The new password must be different from the old password',
  PASSWORD_NOT_SET:
    'Password change is not available for OAuth accounts. Please use your OAuth provider to manage your account.',
  INVALID_PASSWORD_FORMAT: 'The new password does not meet the required format',
  PASSWORD_CHANGE_LIMIT_EXCEEDED: 'PASSWORD_CHANGE_LIMIT_EXCEEDED',
} as const;

export const USERS_CONFIG = {
  PASSWORD_CHANGE_LIMIT: 5, // Maximum attempts
  PASSWORD_CHANGE_WINDOW: 3600, // 1 hour in seconds (time window for rate limiting)
};
