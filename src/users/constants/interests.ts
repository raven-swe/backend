export const INTEREST_CODES = [
  'CULTURE',
  'FINANCE',
  'MEDICAL',
  'POLITICS',
  'SPORTS',
  'TECH',
  'ENTERTAINMENT',
  'GENERAL',
  'FOOD',
  'LEARNING',
  'TRAVEL',
] as const;

export type InterestCode = (typeof INTEREST_CODES)[number];

export const INTEREST_NAMES: Record<InterestCode, string> = {
  CULTURE: 'Culture',
  FINANCE: 'Finance',
  MEDICAL: 'Medical',
  POLITICS: 'Politics',
  SPORTS: 'Sports',
  TECH: 'Tech',
  ENTERTAINMENT: 'Entertainment',
  GENERAL: 'General',
  FOOD: 'Food',
  LEARNING: 'Learning',
  TRAVEL: 'Travel',
};

export const MIN_INTERESTS_REQUIRED = 1;

export const INTERESTS_ERROR_CODES = {
  INVALID_INTEREST: 'INVALID_INTEREST',
  MIN_INTERESTS_REQUIRED: 'MIN_INTERESTS_REQUIRED',
} as const;

export const INTERESTS_ERROR_MESSAGES = {
  INVALID_INTEREST: 'One or more interests are invalid.',
  MIN_INTERESTS_REQUIRED: `You must select at least ${MIN_INTERESTS_REQUIRED} interest${MIN_INTERESTS_REQUIRED > 1 ? 's' : ''}.`,
} as const;
