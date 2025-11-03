import { PrismaClient } from '@prisma/client';
const defaultPrisma = new PrismaClient();

const MIN_USERNAME_LEN = 3;
const MAX_USERNAME_LEN = 15;

let fakerInstance: typeof import('@faker-js/faker').faker | null = null;
async function getFaker() {
  if (!fakerInstance) {
    const { faker } = await import('@faker-js/faker');
    fakerInstance = faker;
  }
  return fakerInstance;
}

function validUsername(username: string): boolean {
  if (username.length < MIN_USERNAME_LEN || username.length > MAX_USERNAME_LEN) return false;
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  return usernameRegex.test(username);
}

export async function filterUsedGeneratedUsernames(candidates: string[], prisma: PrismaClient) {
  const taken = await prisma.user.findMany({
    where: { username: { in: candidates } },
    select: { username: true },
  });
  const takenSet = new Set(taken.map((r) => r.username));
  return candidates.filter((c) => !takenSet.has(c));
}

/**
 * Generates a list of available usernames based on a display name.
 *
 * - Combines deterministic and random strategies to generate plausible usernames.
 * - Only letters, numbers, and underscores are allowed. Length is 3-30 chars.
 * - Checks against the database for taken usernames and returns only available ones.
 * - The function will attempt to return up to `expectedCount` usernames, but this is NOT guaranteed:
 *   - The function tries to guarantee at least `1` usernames.
 *
 * @param displayName The user's display name (e.g. "Anas Ibrahem")
 * @param email The user's email (used as a fallback for generating usernames)
 * @param prisma Optional Prisma client (default: global instance)
 * @param expectedCount The number of usernames to try to return (not guaranteed) (max 10)
 * @returns Array of available usernames (try to guarantee at least 1 username)
 */
export async function generateUsernames(
  displayName?: string,
  email?: string,
  prisma?: PrismaClient,
  expectedCount = 8,
): Promise<string[]> {
  // TODO handle arabic displayNAMES

  if (expectedCount <= 0) {
    throw new Error('expectedCount must be greater than 0');
  }

  if (expectedCount > 10) {
    expectedCount = 10;
  }

  if (!displayName) {
    displayName = '';
  }

  const [first = '', last = ''] = displayName.trim().split(/\s+/);
  let candidates = new Set<string>();

  // Approach one some fixed combinations (looks cool)
  if (first) candidates.add(first.toLowerCase());
  if (last) candidates.add(last.toLowerCase());
  if (first && last) {
    candidates.add(`${first}${last}`.toLowerCase());
    candidates.add(`${first}_${last}`.toLowerCase());
  }

  candidates = new Set(Array.from(candidates).filter(validUsername));
  let available = await filterUsedGeneratedUsernames([...candidates], prisma ?? defaultPrisma);

  if (available.length === 0) {
    candidates.clear();
    // Approach two some faker uername combinations
    const faker = await getFaker();
    let attempts = 0;
    while (candidates.size < expectedCount * 2.5 && attempts < 50) {
      attempts++;
      let newCandidate = faker.internet
        .username({ firstName: first, lastName: last })
        .toLowerCase();
      if (newCandidate.length > MAX_USERNAME_LEN) {
        newCandidate = newCandidate.slice(0, MAX_USERNAME_LEN);
      }
      if (validUsername(newCandidate)) candidates.add(newCandidate);
    }
    available = await filterUsedGeneratedUsernames([...candidates], prisma ?? defaultPrisma);
  }

  if (available.length === 0) {
    candidates.clear();

    // before last approach take first part of email and add some 3 digit number to to it
    const emailPrefix = email ? email.split('@')[0] : 'user';
    let attempts = 0;
    while (candidates.size < expectedCount * 3 && attempts < 50) {
      attempts++;
      let newCandidate =
        `${emailPrefix}${String(Math.floor(100 + Math.random() * 900))}`.toLowerCase();
      if (newCandidate.length > MAX_USERNAME_LEN) {
        newCandidate = newCandidate.slice(0, MAX_USERNAME_LEN);
      }
      if (validUsername(newCandidate)) candidates.add(newCandidate);
    }
    available = await filterUsedGeneratedUsernames([...candidates], prisma ?? defaultPrisma);
  }

  if (available.length === 0) {
    candidates.clear();

    // Final approach: add username timestamp suffix
    let attempts = 0;
    while (candidates.size < expectedCount * 3 && attempts < 50) {
      attempts++;
      const timestamp =
        Date.now().toString().slice(-4) +
        Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0');

      const base = 'u';
      let newCandidate = `${base}${timestamp}`;
      if (newCandidate.length > MAX_USERNAME_LEN) {
        newCandidate = newCandidate.slice(0, MAX_USERNAME_LEN);
      }
      if (validUsername(newCandidate)) candidates.add(newCandidate);
    }
    available = await filterUsedGeneratedUsernames([...candidates], prisma ?? defaultPrisma);
  }

  return available.slice(0, expectedCount);
}
