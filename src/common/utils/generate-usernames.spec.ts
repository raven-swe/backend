import { faker } from '@faker-js/faker';
import type { PrismaClient } from '@prisma/client';
import {
  filterUsedGeneratedUsernames,
  generateUsernames,
} from './generate-vaildate-usernames.util';

const MIN_USERNAME_LEN = 3;
const MAX_USERNAME_LEN = 30;

// TODO test cases
// users with only firstname
// useres with empty display names
// users with a displayname shorterthan (min mength)
jest.mock('@faker-js/faker', () => ({
  faker: {
    internet: {
      username: jest.fn((opts?: { firstName?: string; lastName?: string }) => {
        // Use a queue for return values if set by mockReturnValueOnce
        if ((jest as any).mockUsernameQueue && (jest as any).mockUsernameQueue.length) {
          return (jest as any).mockUsernameQueue.shift();
        }
        // Otherwise, return a default value
        return [opts?.firstName, opts?.lastName].filter(Boolean).join('_') || 'defaultuser';
      }),
    },
  },
}));

// Helper to create a mock Prisma client
function createMockPrisma(takenUsernames: string[] = []) {
  return {
    user: {
      findMany: jest.fn(async ({ where }) => {
        const { in: requested } = where.username;
        return takenUsernames
          .filter((u) => requested.includes(u))
          .map((username) => ({ username }));
      }),
    },
  } as unknown as PrismaClient;
}

describe('filterUsedGeneratedUsernames', () => {
  it('returns empty array if candidates is empty', async () => {
    const prisma = createMockPrisma([]);
    const result = await filterUsedGeneratedUsernames([], prisma);
    expect(result).toEqual([]);
  });

  it('returns empty array if all candidates are taken', async () => {
    const candidates = ['a', 'b', 'c'];
    const prisma = createMockPrisma(['a', 'b', 'c']);
    const result = await filterUsedGeneratedUsernames(candidates, prisma);
    expect(result).toEqual([]);
  });

  it('returns all candidates if none are taken', async () => {
    const candidates = ['anasibrahem', 'anasibrahem2', 'anas'];
    const prisma = createMockPrisma(['a', 'b', 'c']);
    const result = await filterUsedGeneratedUsernames(candidates, prisma);
    expect(result).toEqual(['anasibrahem', 'anasibrahem2', 'anas']);
  });

  it('handles large candidate lists efficiently', async () => {
    const candidates = Array.from({ length: 100 }, (_, i) => `user${i}`);
    const taken = candidates.slice(0, 50); // first 50 taken
    const prisma = createMockPrisma(taken);
    const result = await filterUsedGeneratedUsernames(candidates, prisma);
    expect(result.length).toBe(50);
    expect(result).toEqual(candidates.slice(50));
  });
  it('filters out taken usernames using Prisma', async () => {
    const prisma = createMockPrisma(['anas', 'taken']);
    const candidates = ['anas', 'salem', 'taken', 'unique'];
    const result = await filterUsedGeneratedUsernames(candidates, prisma);
    expect(result).toEqual(['salem', 'unique']);
  });
});

describe('generateUsernames', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns plausible usernames for empty display name', async () => {
    (jest as any).mockUsernameQueue = ['coolwolf', 'bravobear'];
    const prisma = createMockPrisma([]);
    const result = await generateUsernames('', 2, prisma);
    expect(result).toEqual(['coolwolf', 'bravobear']);
  });

  it('never returns usernames with invalid characters', async () => {
    (jest as any).mockUsernameQueue = ['bad!name', 'ok_name', 'fine.name'];
    const prisma = createMockPrisma([]);
    const result = await generateUsernames('John', 3, prisma);
    expect(result.some((u: string) => /[^a-zA-Z0-9._]/.test(u))).toBe(false);
  });

  it('enforces min and max username length', async () => {
    (jest as any).mockUsernameQueue = [
      'a',
      'thisisaveryverylongusernameover30chars',
      'normal_name',
    ];
    const prisma = createMockPrisma([]);
    const result = await generateUsernames('A B', 3, prisma);
    expect(result.some((u: string) => u.length < MIN_USERNAME_LEN)).toBe(false);
    expect(result.some((u: string) => u.length > MAX_USERNAME_LEN)).toBe(false);
  });

  it('suggests available usernames (integration)', async () => {
    const prisma = createMockPrisma(['anas', 'anas.salem']);
    (jest as any).mockUsernameQueue = ['anas', 'anas.salem', 'salem', 'uniqueuser'];
    const result = await generateUsernames('Anas Salem', 5, prisma);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.some((u: string) => u === 'salem' || u === 'uniqueuser')).toBe(true);
  });
});
