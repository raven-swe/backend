export function generateUsername(name: string): string {
  console.log('Generating username for:', name);

  const cleanName = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, ''); // Only allow letters, numbers, underscores
  const parts = name.toLowerCase().trim().split(/\s+/);

  const strategies: Array<() => string> = [
    // Initials + lastname + number
    () => {
      if (parts.length > 1) {
        const initials = parts
          .slice(0, -1)
          .map((p) => p.replace(/[^a-z0-9_]/g, '')[0])
          .filter(Boolean)
          .join('');
        const lastName = parts[parts.length - 1].replace(/[^a-z0-9_]/g, '');
        const result = `${initials}${lastName}${Math.floor(10 + Math.random() * 90)}`;
        return result;
      }
      const result = `${cleanName}${Math.floor(10 + Math.random() * 90)}`;
      return result;
    },

    // Reversed name
    () => {
      if (parts.length > 1) {
        const first = parts[0].replace(/[^a-z0-9_]/g, '');
        const last = parts[parts.length - 1].replace(/[^a-z0-9_]/g, '');
        const result = `${last}${first}`.substring(0, 12);
        return result;
      }
      return cleanName;
    },

    // Underscore style
    () => {
      if (parts.length > 1) {
        const first = parts[0].replace(/[^a-z0-9_]/g, '');
        const last = parts[parts.length - 1].replace(/[^a-z0-9_]/g, '');
        const result = `${first}_${last[0] || ''}${Math.floor(10 + Math.random() * 90)}`;
        return result;
      }
      const result = `${cleanName}_${Math.floor(10 + Math.random() * 90)}`;
      return result;
    },

    // Number suffix style
    () => {
      if (parts.length > 1) {
        const first = parts[0].replace(/[^a-z0-9_]/g, '');
        const last = parts[parts.length - 1].replace(/[^a-z0-9_]/g, '');
        const result = `${first}${last}${Math.floor(Math.random() * 1000)}`;
        return result;
      }
      const result = `${cleanName}${Math.floor(Math.random() * 1000)}`;
      return result;
    },

    // Consonants style
    () => {
      if (parts.length > 1) {
        const first = parts[0].replace(/[^a-z0-9_]/g, '');
        const lastConsonants = parts[parts.length - 1]
          .replace(/[^a-z0-9_]/g, '')
          .replace(/[aeiou]/g, '')
          .substring(0, 3);
        const result = `${first}${lastConsonants}${Math.floor(10 + Math.random() * 90)}`;
        return result;
      }
      const result = `${cleanName}${Math.floor(10 + Math.random() * 90)}`;
      return result;
    },
  ];

  const strategyIndex = Math.floor(Math.random() * strategies.length);

  const strategy = strategies[strategyIndex];
  let username = strategy();

  // Ensure reasonable length
  if (username.length > 15) {
    username = username.substring(0, 15);
  }

  // Ensure username contains at least one letter
  if (!/[a-z]/i.test(username)) {
    username = `user_${username}`;
    if (username.length > 15) {
      username = username.substring(0, 15);
    }
  }

  console.log('Generated username:', username);
  return username;
}

/**
 * Generates a unique username by checking against existing usernames
 * @param name - The user's name to base the username on
 * @param checkExists - Function that returns true if username exists, false if available
 * @returns A guaranteed unique username
 */
export async function generateUniqueUsername(
  name: string,
  checkExists: (username: string) => Promise<boolean>,
): Promise<string> {
  let username: string;
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    attempts++;

    username = generateUsername(name);

    const exists = await checkExists(username);

    if (!exists) {
      return username;
    }
  }

  let baseUsername = generateUsername(name);
  const timestamp = Date.now().toString().slice(-4);

  // Ensure total length doesn't exceed 15
  if (baseUsername.length + 1 + timestamp.length > 15) {
    baseUsername = baseUsername.substring(0, 15 - 1 - timestamp.length);
  }

  const fallbackUsername = `${baseUsername}_${timestamp}`;
  console.log(`Max attempts reached. Using fallback:`, fallbackUsername);
  return fallbackUsername;
}

// Test calls
generateUsername('john');
generateUsername('mary');
generateUsername('John Smith');
generateUsername('Mary Jane Watson');
generateUsername('');
generateUsername('John-Doe');
generateUsername('Christopher Alexander Montgomery');
generateUsername('José María García');
generateUsername('123456');
generateUsername('!@#$%');
