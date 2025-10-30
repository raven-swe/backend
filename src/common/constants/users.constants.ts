export const USERS_ERROR_CODES = {
  INVALID_OLD_PASSWORD: 'INVALID_OLD_PASSWORD',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  NEW_PASSWORD_SAME_AS_OLD: 'NEW_PASSWORD_SAME_AS_OLD',
  PASSWORD_NOT_SET: 'PASSWORD_NOT_SET',
  INVALID_PASSWORD_FORMAT: 'INVALID_PASSWORD_FORMAT',
  EMAIL_ALREADY_USED: 'EMAIL_ALREADY_USED',
  CANNOT_FOLLOW_SELF: 'CANNOT_FOLLOW_SELF',
  ALREADY_FOLLOWING: 'ALREADY_FOLLOWING',
  CANT_BLOCK_SELF: 'CANT_BLOCK_SELF',
  ALREADY_BLOCKED: 'ALREADY_BLOCKED',
  NOT_BLOCKED: 'NOT_BLOCKED',
  CANT_MUTE_SELF: 'CANT_MUTE_SELF',
  ALREADY_MUTED: 'ALREADY_MUTED',
  NOT_MUTED: 'NOT_MUTED',
} as const;

export const USERS_ERROR_MESSAGES = {
  INVALID_OLD_PASSWORD: 'The old password provided is incorrect',
  USER_NOT_FOUND: 'User not found',
  NEW_PASSWORD_SAME_AS_OLD: 'The new password must be different from the old password',
  PASSWORD_NOT_SET:
    'Password change is not available for OAuth accounts. Please use your OAuth provider to manage your account.',
  INVALID_PASSWORD_FORMAT: 'The new password does not meet the required format',
  EMAIL_ALREADY_USED: 'Email has already been taken',
  CANNOT_FOLLOW_SELF: 'A user cannot follow themselves',
  ALREADY_FOLLOWING: 'You are already following this user',
  CANT_BLOCK_SELF: 'A user cannot block themselves',
  ALREADY_BLOCKED: 'You have already blocked this user',
  NOT_BLOCKED: 'This user is not blocked',
  CANT_MUTE_SELF: 'A user cannot mute themselves',
  ALREADY_MUTED: 'You have already muted this user',
  NOT_MUTED: 'This user is not muted',
} as const;
