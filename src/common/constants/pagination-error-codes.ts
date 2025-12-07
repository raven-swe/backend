export const PAGINATION_ERROR_CODES = {
  INVALID_CURSOR: 'INVALID_CURSOR',
  INVALID_FILTER: 'INVALID_FILTER',
} as const;

export const PAGINATION_ERROR_MESSAGES = {
  INVALID_CURSOR: 'The provided cursor is invalid.',
  INVALID_FILTER: 'The provided filter is invalid.',
} as const;
