import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';
const defaultPrisma = new PrismaClient();

const MIN_USERNAME_LEN = 3;
const MAX_USERNAME_LEN = 30;

function validUsername(username: string): boolean {
  if (username.length < MIN_USERNAME_LEN || username.length > MAX_USERNAME_LEN) return false;
  const usernameRegex = /^[a-zA-Z0-9._]+$/;
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

export async function generateUsernames(
  displayName: string,
  count = 8,
  prisma?: PrismaClient,
): Promise<string[]> {
  const [first = '', last = ''] = displayName.trim().split(/\s+/);
  let candidates = new Set<string>();

  if (first) candidates.add(first.toLowerCase());
  if (last) candidates.add(last.toLowerCase());
  if (first && last) {
    candidates.add(`${first}${last}`.toLowerCase());
    candidates.add(`${first}.${last}`.toLowerCase());
    candidates.add(`${first}_${last}`.toLowerCase());
  }

  candidates = new Set(Array.from(candidates).filter(validUsername));

  // fill in with random faker usernames
  let attempts = 0;
  while (candidates.size < count * 2 && attempts < 50) {
    attempts++;
    const newCandidate = faker.internet
      .username({ firstName: first, lastName: last })
      .toLowerCase();
    if (validUsername(newCandidate)) candidates.add(newCandidate);
  }

  const available = await filterUsedGeneratedUsernames([...candidates], prisma ?? defaultPrisma);
  // Filter for valid usernames before returning
  return available.slice(0, count);
}
