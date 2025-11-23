import { UsersRepository } from 'src/users/users.repository';
import { MIN_USERNAME_LEN, MAX_USERNAME_LEN } from 'src/users/constants/users';
import { generateUsernames } from 'src/common/utils/generate-usernames.util';

function createMockUsersRepository(takenUsernames: string[] = []): UsersRepository {
  return {
    findTakenUsernames: jest.fn((candidates: string[]) => {
      const takenSet = new Set(takenUsernames.filter((u) => candidates.includes(u)));
      return Promise.resolve(takenSet);
    }),
  } as unknown as UsersRepository;
}

describe('generateUsernames', () => {
  let mockRepository: UsersRepository;

  beforeEach(() => {
    mockRepository = createMockUsersRepository();
    jest.clearAllMocks();
  });

  describe('validation and constraints', () => {
    it('should throw error if expectedCount is zero or negative', async () => {
      await expect(
        generateUsernames(mockRepository, 'anas hima', 'anas@example.com', undefined, 0),
      ).rejects.toThrow('expectedCount must be greater than 0');

      await expect(
        generateUsernames(mockRepository, 'anas hima', 'anas@example.com', undefined, -5),
      ).rejects.toThrow('expectedCount must be greater than 0');
    });

    it('should cap expectedCount at 10', async () => {
      const result = await generateUsernames(
        mockRepository,
        '',
        'test@example.com',
        undefined,
        50,
        true,
      );
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe('email-based fallback', () => {
    it('should use email prefix when display name is empty', async () => {
      const result = await generateUsernames(
        mockRepository,
        '',
        'uniqueuser@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
      result.forEach((username: string) => {
        expect(username.length).toBeGreaterThanOrEqual(MIN_USERNAME_LEN);
        expect(username.length).toBeLessThanOrEqual(MAX_USERNAME_LEN);
      });
    });

    it('should truncate long email prefixes', async () => {
      const longEmail = 'a'.repeat(20) + '@example.com';
      const result = await generateUsernames(mockRepository, '', longEmail, undefined, 3, true);
      result.forEach((username: string) => {
        expect(username.length).toBeLessThanOrEqual(MAX_USERNAME_LEN);
      });
    });

    it('should generate valid usernames from email', async () => {
      const result = await generateUsernames(
        mockRepository,
        '',
        'testuser@example.com',
        undefined,
        5,
        true,
      );
      const validPattern = /^(?=.*[a-zA-Z])[a-zA-Z0-9_]+$/;
      result.forEach((username: string) => {
        expect(validPattern.test(username)).toBe(true);
      });
    });
  });

  describe('timestamp-based fallback', () => {
    it('should generate timestamp-based usernames as last resort', async () => {
      const result = await generateUsernames(mockRepository, '', '', undefined, 3, true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((u: string) => /^u\d+/.test(u))).toBe(true);
    });

    it('should skip fallbacks when disabled', async () => {
      const result = await generateUsernames(
        mockRepository,
        '',
        'test@example.com',
        undefined,
        3,
        false,
      );
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('availability checking', () => {
    it('should exclude taken usernames from results', async () => {
      const takenUsernames = ['testuser123', 'testuser456', 'testuser789'];
      mockRepository = createMockUsersRepository(takenUsernames);

      const result = await generateUsernames(
        mockRepository,
        '',
        'testuser@example.com',
        undefined,
        5,
        true,
      );

      result.forEach((username: string) => {
        expect(takenUsernames).not.toContain(username);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty display name', async () => {
      const result = await generateUsernames(
        mockRepository,
        '',
        'test@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle undefined display name', async () => {
      const result = await generateUsernames(
        mockRepository,
        undefined,
        'test@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle display name with only special characters', async () => {
      const result = await generateUsernames(
        mockRepository,
        '@#$%^&*',
        'test@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return only unique usernames', async () => {
      const result = await generateUsernames(
        mockRepository,
        '',
        'test@example.com',
        undefined,
        8,
        true,
      );
      const uniqueResults = new Set(result);
      expect(uniqueResults.size).toBe(result.length);
    });

    it('should handle whitespace-only display name', async () => {
      const result = await generateUsernames(
        mockRepository,
        '   ',
        'test@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Arabic display names', () => {
    it('should handle Arabic characters in display name', async () => {
      const result = await generateUsernames(
        mockRepository,
        'أحمد محمد',
        'ahmed@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
      result.forEach((username: string) => {
        expect(username.length).toBeGreaterThanOrEqual(MIN_USERNAME_LEN);
        expect(username.length).toBeLessThanOrEqual(MAX_USERNAME_LEN);
      });
    });

    it('should handle mixed Arabic and English display name', async () => {
      const result = await generateUsernames(
        mockRepository,
        'علي Ali Smith',
        'ali@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
      const validPattern = /^(?=.*[a-zA-Z])[a-zA-Z0-9_]+$/;
      result.forEach((username: string) => {
        expect(validPattern.test(username)).toBe(true);
      });
    });

    it('should handle Arabic display name with no Latin characters', async () => {
      const result = await generateUsernames(
        mockRepository,
        'فاطمة الزهراء',
        'fatima@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
      result.forEach((username: string) => {
        expect(username.length).toBeGreaterThanOrEqual(MIN_USERNAME_LEN);
      });
    });
  });

  describe('Very long inputs', () => {
    it('should handle extremely long display name', async () => {
      const longName = 'A'.repeat(100) + ' ' + 'B'.repeat(100);
      const result = await generateUsernames(
        mockRepository,
        longName,
        'test@example.com',
        undefined,
        3,
        true,
      );
      result.forEach((username: string) => {
        expect(username.length).toBeLessThanOrEqual(MAX_USERNAME_LEN);
        expect(username.length).toBeGreaterThanOrEqual(MIN_USERNAME_LEN);
      });
    });

    it('should handle very long email address', async () => {
      const longEmailPrefix = 'a'.repeat(50);
      const longEmail = `${longEmailPrefix}@verylongdomainname.example.com`;
      const result = await generateUsernames(mockRepository, '', longEmail, undefined, 3, true);
      result.forEach((username: string) => {
        expect(username.length).toBeLessThanOrEqual(MAX_USERNAME_LEN);
      });
    });
  });

  describe('Special character handling', () => {
    it('should handle display name with numbers only', async () => {
      const result = await generateUsernames(
        mockRepository,
        '123456',
        'numbers@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle display name with mixed special characters', async () => {
      const result = await generateUsernames(
        mockRepository,
        'anas!@#hima$%^',
        'anas@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
      result.forEach((username: string) => {
        expect(username).not.toContain('!');
        expect(username).not.toContain('@');
        expect(username).not.toContain('#');
        expect(username).not.toContain('$');
      });
    });
  });

  describe('Email edge cases', () => {
    it('should handle email with special characters in prefix', async () => {
      const result = await generateUsernames(
        mockRepository,
        '',
        'user+tag@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle email with numbers', async () => {
      const result = await generateUsernames(
        mockRepository,
        '',
        '123@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle two character email prefix', async () => {
      const result = await generateUsernames(
        mockRepository,
        '',
        'a@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
      result.forEach((username: string) => {
        expect(username.length).toBeGreaterThanOrEqual(MIN_USERNAME_LEN);
      });
    });
  });

  describe('Multi-word display names', () => {
    it('should handle three-word display name', async () => {
      const result = await generateUsernames(
        mockRepository,
        'anas ibrahem ahmed ismael',
        'test@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle display name with many spaces', async () => {
      const result = await generateUsernames(
        mockRepository,
        'anas    hima',
        'anas@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle display name with leading and trailing spaces', async () => {
      const result = await generateUsernames(
        mockRepository,
        '  anas hima  ',
        'anas@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle display name with tabs and newlines', async () => {
      const result = await generateUsernames(
        mockRepository,
        'anas\thima\nali',
        'anas@example.com',
        undefined,
        3,
        true,
      );
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
