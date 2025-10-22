export const USERS_ERROR_CODES = {
  INVALID_OLD_PASSWORD: 'INVALID_OLD_PASSWORD',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  NEW_PASSWORD_SAME_AS_OLD: 'NEW_PASSWORD_SAME_AS_OLD',
  PASSWORD_NOT_SET: 'PASSWORD_NOT_SET',
} as const;

export const USERS_ERROR_MESSAGES = {
  INVALID_OLD_PASSWORD: 'The old password provided is incorrect',
  USER_NOT_FOUND: 'User not found',
  NEW_PASSWORD_SAME_AS_OLD: 'The new password must be different from the old password',
  PASSWORD_NOT_SET:
    'Password change is not available for OAuth accounts. Please use your OAuth provider to manage your account.',
} as const;
