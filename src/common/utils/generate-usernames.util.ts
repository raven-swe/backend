import { UsersRepository } from '../../users/users.repository';
import { MAX_USERNAME_LEN, MIN_USERNAME_LEN, USERNAME_REGEX } from 'src/users/constants/users';
let fakerInstance: typeof import('@faker-js/faker').faker | null = null;
async function getFaker() {
  if (!fakerInstance) {
    const { faker } = await import('@faker-js/faker');
    fakerInstance = faker;
  }
  return fakerInstance;
}

function validUsername(username: string) {
  if (username.length < MIN_USERNAME_LEN || username.length > MAX_USERNAME_LEN) return false;
  return USERNAME_REGEX.test(username);
}

function adjustLen(username: string) {
  const fillerChars = '0123456789_';
  username = username.slice(0, MAX_USERNAME_LEN);

  if (username.length < MIN_USERNAME_LEN) {
    const targetLen = MIN_USERNAME_LEN + 1;
    while (username.length < targetLen) {
      username += fillerChars[Math.floor(Math.random() * fillerChars.length)];
    }
  }

  return username;
}

function parseTyped(typed: string) {
  // replace invalid chars (arabic is valid) (except spaces) and underscores and numbers with ''
  typed = typed.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
  // replace spaces with underscores
  typed = typed.replace(/\s+/g, '_');

  if (typed.length >= MAX_USERNAME_LEN) {
    typed = typed.slice(0, MAX_USERNAME_LEN - 3);
  }

  // if typed is only underscores, return empty string
  if (/^_+$/.test(typed)) {
    typed = '';
  }

  return typed;
}

async function filterUsedGeneratedUsernames(
  candidates: string[],
  usersRepository: UsersRepository,
) {
  const takenSet = await usersRepository.findTakenUsernames(candidates);
  return candidates.filter((c) => !takenSet.has(c));
}

export async function generateUsernames(
  usersRepository: UsersRepository,
  displayName?: string,
  email?: string,
  typed?: string,
  expectedCount = 3,
  fallback = true,
): Promise<string[]> {
  const GEN_ATTEMPTS = 32;
  const MAX_GENERATED_USERNAMES = 10;

  if (expectedCount <= 0) {
    throw new Error('expectedCount must be greater than 0');
  }

  if (expectedCount > MAX_GENERATED_USERNAMES) {
    expectedCount = MAX_GENERATED_USERNAMES;
  }

  if (!displayName) {
    displayName = '';
  }

  if (displayName.length >= MAX_USERNAME_LEN) {
    displayName = displayName.slice(0, MAX_USERNAME_LEN - 3);
  }

  if (typed) {
    typed = parseTyped(typed);
  }

  let [first = '', last = ''] = displayName.trim().split(/\s+/);
  let candidates = new Set<string>();

  // make sure first and last are alphanumeric or _ or Arabic characters
  first = first.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '');
  last = last.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '');

  candidates = new Set(Array.from(candidates).filter(validUsername));
  let available = await filterUsedGeneratedUsernames([...candidates], usersRepository);

  if (available.length < expectedCount && (first || last || typed)) {
    candidates.clear();
    const faker = await getFaker();

    let attempts = 0;
    while (attempts < GEN_ATTEMPTS) {
      attempts++;

      if (typed) {
        const typedBased = adjustLen(
          faker.internet.username({ firstName: typed, lastName: '' }).toLowerCase(),
        );
        if (validUsername(typedBased)) candidates.add(typedBased);
      } else {
        const combined = adjustLen(
          faker.internet.username({ firstName: first, lastName: last }).toLowerCase(),
        );
        if (validUsername(combined)) candidates.add(combined);

        const flipped = adjustLen(
          faker.internet.username({ firstName: last, lastName: first }).toLowerCase(),
        );
        if (validUsername(flipped)) candidates.add(flipped);
      }
    }

    available = await filterUsedGeneratedUsernames([...candidates], usersRepository);
  }

  // FALLBACKS FOR USERNAMES NECESSARY FOR REGISTRATION FLOW
  if (available.length === 0 && email && fallback) {
    candidates.clear();
    // Use email prefix + random numbers
    let emailPrefix = email ? email.split('@')[0] : 'user';
    if (emailPrefix.length > MAX_USERNAME_LEN - 3)
      emailPrefix = emailPrefix.slice(0, MAX_USERNAME_LEN - 3);

    let attempts = 0;
    while (attempts < GEN_ATTEMPTS) {
      attempts++;
      const newCandidate =
        `${emailPrefix}${String(Math.floor(100 + Math.random() * 900))}`.toLowerCase();
      if (validUsername(adjustLen(newCandidate))) candidates.add(newCandidate);
    }

    available = await filterUsedGeneratedUsernames([...candidates], usersRepository);
  }

  if (available.length === 0 && fallback) {
    candidates.clear();

    let attempts = 0;
    while (attempts < GEN_ATTEMPTS) {
      attempts++;
      const timestamp =
        Date.now().toString().slice(-4) +
        Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0');

      const base = 'u';
      const newCandidate = `${base}${timestamp}`;
      if (validUsername(adjustLen(newCandidate))) candidates.add(newCandidate);
    }

    available = await filterUsedGeneratedUsernames([...candidates], usersRepository);
  }

  return available.slice(0, expectedCount);
}
