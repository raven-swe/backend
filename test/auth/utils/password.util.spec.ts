import { hashPassword, comparePassword } from 'src/auth/utils';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('Password Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt using 10 rounds', async () => {
      // Arrange
      const password = 'MyPassword123!';
      const expectedHash = 'MyhashedPassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(password);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(result).toBe(expectedHash);
    });

    it('should hash different passwords to different hashes', async () => {
      // Arrange
      const password1 = 'Password1!';
      const password2 = 'Password2!';
      (bcrypt.hash as jest.Mock)
        .mockResolvedValueOnce('MyhashedPassword1')
        .mockResolvedValueOnce('MyhashedPassword2');

      // Act
      const hash1 = await hashPassword(password1);
      const hash2 = await hashPassword(password2);

      // Assert
      expect(hash1).not.toBe(hash2);
      expect(bcrypt.hash).toHaveBeenCalledTimes(2);
    });

    it('should handle empty password', async () => {
      // Arrange
      const password = '';
      const expectedHash = 'MyhashedEmptyPassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(password);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith('', 10);
      expect(result).toBe(expectedHash);
    });

    it('should handle very long passwords', async () => {
      // Arrange
      const longPassword = 'a'.repeat(200);
      const expectedHash = 'hashedLongPassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(longPassword);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(longPassword, 10);
      expect(result).toBe(expectedHash);
    });
  });

  describe('comparePassword', () => {
    it('should return true when password matches hash', async () => {
      // Arrange
      const password = 'MyPassword123!';
      const hashedPassword = 'MyhashedPassword';
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await comparePassword(password, hashedPassword);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it('should return false when password does not match hash', async () => {
      // Arrange
      const password = 'WrongPassword123!';
      const hashedPassword = 'MyhashedPassword';
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await comparePassword(password, hashedPassword);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(false);
    });

    it('should handle empty password comparison', async () => {
      // Arrange
      const password = '';
      const hashedPassword = 'MyhashedEmptyPassword';
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await comparePassword(password, hashedPassword);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith('', hashedPassword);
      expect(result).toBe(true);
    });
  });
});
