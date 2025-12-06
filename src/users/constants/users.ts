export const DEFAULT_PROFILE_PICTURE = 'https://cdn.raven.cmp27.space/default_avatar.png';
export const MAX_USERNAME_LEN = 15;
export const MIN_USERNAME_LEN = 3;
export const USERNAME_REGEX = /^(?=.*[a-zA-Z])[a-zA-Z0-9_]+$/;

export const USERS_ERROR_CODES = {
  INVALID_OLD_PASSWORD: 'INVALID_OLD_PASSWORD',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  NEW_PASSWORD_SAME_AS_OLD: 'NEW_PASSWORD_SAME_AS_OLD',
  PASSWORD_NOT_SET: 'PASSWORD_NOT_SET',
  INVALID_PASSWORD_FORMAT: 'INVALID_PASSWORD_FORMAT',
  EMAIL_ALREADY_USED: 'EMAIL_ALREADY_USED',
  CANNOT_FOLLOW_SELF: 'CANNOT_FOLLOW_SELF',
  CANNOT_UNFOLLOW_SELF: 'CANNOT_UNFOLLOW_SELF',
  ALREADY_FOLLOWING: 'ALREADY_FOLLOWING',
  ALREADY_NOT_FOLLOWING: 'ALREADY_NOT_FOLLOWING',
  CANNOT_BLOCK_SELF: 'CANNOT_BLOCK_SELF',
  ALREADY_BLOCKED: 'ALREADY_BLOCKED',
  NOT_BLOCKED: 'NOT_BLOCKED',
  CANNOT_MUTE_SELF: 'CANNOT_MUTE_SELF',
  ALREADY_MUTED: 'ALREADY_MUTED',
  NOT_MUTED: 'NOT_MUTED',
  USERNAME_ALREADY_USED: 'USERNAME_ALREADY_USED',
  CANNOT_BLOCK_USER: 'CANNOT_BLOCK_USER',
  CANNOT_FOLLOW_USER: 'CANNOT_FOLLOW_USER',
  CANNOT_MUTE_USER: 'CANNOT_MUTE_USER',
  CANNOT_UNMUTE_USER: 'CANNOT_UNMUTE_USER',
  CANNOT_UNBLOCK_USER: 'CANNOT_UNBLOCK_USER',
  CANNOT_UNFOLLOW_USER: 'CANNOT_UNFOLLOW_USER',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  SSO_DOESNOT_EXIST: 'SSO_DOESNOT_EXIST',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  CANNOT_DELETE_CURRENT_SESSION: 'CANNOT_DELETE_CURRENT_SESSION',
  BANNER_NOT_FOUND: 'BANNER_NOT_FOUND',
  INVALID_REQUEST_COMBINATION: 'INVALID_REQUEST_COMBINATION',
} as const;

export const USERS_ERROR_MESSAGES = {
  INVALID_OLD_PASSWORD: 'Old password is incorrect.',
  USER_NOT_FOUND: 'User not found.',
  NEW_PASSWORD_SAME_AS_OLD: 'New password must be different from the old password.',
  PASSWORD_NOT_SET:
    'Password change is not available for OAuth accounts. Please use your OAuth provider to manage your account.',
  INVALID_PASSWORD_FORMAT: 'New password does not meet the required format.',
  EMAIL_ALREADY_USED: 'Email is already in use.',
  USERNAME_ALREADY_USED: 'Username is already taken. Please choose another.',
  CANNOT_FOLLOW_SELF: 'You cannot follow yourself.',
  CANNOT_UNFOLLOW_SELF: 'You cannot unfollow yourself.',
  ALREADY_FOLLOWING: 'You are already following this user.',
  ALREADY_NOT_FOLLOWING: 'You are not following this user.',
  CANNOT_BLOCK_SELF: 'You cannot block yourself.',
  ALREADY_BLOCKED: 'You have already blocked this user.',
  NOT_BLOCKED: 'This user is not blocked.',
  CANNOT_MUTE_SELF: 'You cannot mute yourself.',
  ALREADY_MUTED: 'You have already muted this user.',
  NOT_MUTED: 'This user is not muted.',
  CANNOT_BLOCK_USER: 'You cannot block this user.',
  CANNOT_FOLLOW_USER: 'You cannot follow this user.',
  CANNOT_MUTE_USER: 'You cannot mute this user.',
  CANNOT_UNMUTE_USER: 'You cannot unmute this user.',
  CANNOT_UNBLOCK_USER: 'You cannot unblock this user.',
  CANNOT_UNFOLLOW_USER: 'You cannot unfollow this user.',
  INVALID_PASSWORD: 'Password is incorrect.',
  SSO_DOES_NOT_EXIST: "You haven't used this provider before.",
  SESSION_NOT_FOUND: 'Session not found or does not belong to you.',
  CANNOT_DELETE_CURRENT_SESSION:
    "You can't delete your active session. Please log out if you want to remove it.",
  BANNER_NOT_FOUND: 'User banner not found.',
  INVALID_COUNTRY: 'The specified country is not supported.',
  ALLOWED_IMAGE_TYPES: 'Only image files are allowed (jpg, jpeg, png, webp).',
  INVALID_GENDER: 'Invalid gender, valid options are Male and Female only.',
  INVALID_LANGUAGE: 'Invalid language, valid options are AR and EN only.',
  INVALID_REQUEST_COMBINATION: 'Cannot upload and delete the same media in a single request',
} as const;

export const USER_SEARCH_RANKING_WEIGHTS = {
  SIMILARITY: 5000, // Primary factor: text similarity
  I_FOLLOW: 500, // Strong: users I follow
  FOLLOWS_ME: 300, // Good: users who follow me
  FOLLOWERS: 100, // Moderate: popularity (per follower)
  MAX_FOLLOWERS_COUNT: 10_000, // Cap follower count
} as const;
