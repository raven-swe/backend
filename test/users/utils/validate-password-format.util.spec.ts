import { HttpException, HttpStatus } from '@nestjs/common';
import { validateNewPasswordFormat } from 'src/users/utils';
import { ChangePasswordBasicDto } from 'src/users/dtos';

describe('validateNewPasswordFormat', () => {
  describe('valid passwords', () => {
    it('should pass for valid password with all requirements', async () => {
      const dto: ChangePasswordBasicDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'ValidPass123!',
      };

      await expect(validateNewPasswordFormat(dto)).resolves.toBeUndefined();
    });

    it('should pass for password with minimum length and all character types', async () => {
      const dto: ChangePasswordBasicDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'Aa1!bcdefg',
      };

      await expect(validateNewPasswordFormat(dto)).resolves.toBeUndefined();
    });

    it('should pass for password with multiple symbols', async () => {
      const dto: ChangePasswordBasicDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'Pass@word#123$',
      };

      await expect(validateNewPasswordFormat(dto)).resolves.toBeUndefined();
    });

    it('should pass for long password', async () => {
      const dto: ChangePasswordBasicDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'VeryLongPassword123!WithManyCharacters',
      };

      await expect(validateNewPasswordFormat(dto)).resolves.toBeUndefined();
    });
  });

  describe('invalid passwords', () => {
    it('should throw error for password shorter than 10 characters', async () => {
      const dto: ChangePasswordBasicDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'Short1!',
      };

      await expect(validateNewPasswordFormat(dto)).rejects.toThrow(HttpException);
      try {
        await validateNewPasswordFormat(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should throw error for password without uppercase letter', async () => {
      const dto: ChangePasswordBasicDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'lowercase123!',
      };

      await expect(validateNewPasswordFormat(dto)).rejects.toThrow(HttpException);
      try {
        await validateNewPasswordFormat(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should throw error for password without lowercase letter', async () => {
      const dto: ChangePasswordBasicDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'UPPERCASE123!',
      };

      await expect(validateNewPasswordFormat(dto)).rejects.toThrow(HttpException);
      try {
        await validateNewPasswordFormat(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should throw error for password without number', async () => {
      const dto: ChangePasswordBasicDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NoNumberPass!',
      };

      await expect(validateNewPasswordFormat(dto)).rejects.toThrow(HttpException);
      try {
        await validateNewPasswordFormat(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should throw error for password without symbol', async () => {
      const dto: ChangePasswordBasicDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NoSymbolPass123',
      };

      await expect(validateNewPasswordFormat(dto)).rejects.toThrow(HttpException);
      try {
        await validateNewPasswordFormat(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should throw error for password with multiple validation failures', async () => {
      const dto: ChangePasswordBasicDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'short',
      };

      await expect(validateNewPasswordFormat(dto)).rejects.toThrow(HttpException);
      try {
        await validateNewPasswordFormat(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });
  });
});
