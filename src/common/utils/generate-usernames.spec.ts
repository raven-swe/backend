import type { PrismaClient } from '@prisma/client';
import {
  filterUsedGeneratedUsernames,
  generateUsernames,
} from './generate-vaildate-usernames.util';

const MIN_USERNAME_LEN = 3;
const MAX_USERNAME_LEN = 30;

// Helper to create a mock Prisma client
function createMockPrisma(takenUsernames: string[] = []) {
  return {
    user: {
      findMany: jest.fn(({ where }: { where: { username: { in: string[] } } }) => {
        const requested = where.username.in;
        return Promise.resolve(
          takenUsernames.filter((u) => requested.includes(u)).map((username) => ({ username })),
        );
      }),
    },
  } as unknown as PrismaClient;
}

describe('filterUsedGeneratedUsernames', () => {
  it('returns empty array if all candidates are taken', async () => {
    const candidates = ['a', 'b', 'c'];
    const prisma = createMockPrisma(['a', 'b', 'c']);
    const result = await filterUsedGeneratedUsernames(candidates, prisma);
    expect(result).toEqual([]);
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
    const candidates = ['anas', 'ibrahem', 'taken', 'unique'];
    const result = await filterUsedGeneratedUsernames(candidates, prisma);
    expect(result).toEqual(['ibrahem', 'unique']);
  });
});

describe('generateUsernames', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enforces min and max username length', async () => {
    const prisma = createMockPrisma([]);
    const result = await generateUsernames('A B', '', prisma, 3);
    expect(result.some((u: string) => u.length < MIN_USERNAME_LEN)).toBe(false);
    expect(result.some((u: string) => u.length > MAX_USERNAME_LEN)).toBe(false);
  });

  it('handles users with only firstname', async () => {
    const prisma = createMockPrisma([]);
    const result = await generateUsernames('Alice', '', prisma, 3);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('alice');
    expect(result.every((u: string) => u.length >= MIN_USERNAME_LEN)).toBe(true);
  });
});
