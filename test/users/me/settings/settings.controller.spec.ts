import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from 'src/users/me/settings/settings.controller';
import { SettingsService } from 'src/users/me/settings/settings.service';
import {
  InititateEmailUpdateDto,
  VerifyEmailUpdateDto,
  ResendEmailUpdateOtp,
} from 'src/users/dtos';
import type { RequestUser, RequestWithCookies } from 'src/common/interfaces';
import { BadRequestException, HttpException } from '@nestjs/common';

describe('SettingsController', () => {
  let controller: SettingsController;

  const mockSettingsService = {
    checkNewEmail: jest.fn(),
    verifyEmailUpdate: jest.fn(),
    resendEmailUpdateOtp: jest.fn(),
    updateUsername: jest.fn(),
    getUserDetails: jest.fn(),
    updateBirthDate: jest.fn(),
    getUserSSOs: jest.fn(),
    removeUserSSO: jest.fn(),
    getCountries: jest.fn(),
    changeCountry: jest.fn(),
    updateGender: jest.fn(),
    updateLanguage: jest.fn(),
    validatePassword: jest.fn(),
    getSessions: jest.fn(),
    deleteSession: jest.fn(),
    getUserBlockedUsers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('inititateEmailUpdate', () => {
    it('should initiate email update successfully', async () => {
      const dto: InititateEmailUpdateDto = {
        newEmail: 'newemail@example.com',
      };
      const expectedResult = { confirmationToken: 'test-token-123' };

      mockSettingsService.checkNewEmail.mockResolvedValue(expectedResult);

      const mockRequestUser = {
        id: '1',
        username: 'omarhassan',
      } as RequestUser;

      const result = await controller.inititateEmailUpdate(dto, mockRequestUser);

      expect(mockSettingsService.checkNewEmail).toHaveBeenCalledWith(BigInt(1), dto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors from service', async () => {
      const dto: InititateEmailUpdateDto = {
        newEmail: 'existing@example.com',
      };
      const error = new Error('Email already in use');

      const mockRequestUser = {
        id: '1',
        username: 'omarhassan',
      } as RequestUser;

      mockSettingsService.checkNewEmail.mockRejectedValue(error);

      await expect(controller.inititateEmailUpdate(dto, mockRequestUser)).rejects.toThrow(error);
    });
  });

  describe('verifyUpdateEmailOtp', () => {
    it('should verify email update OTP successfully', async () => {
      const dto: VerifyEmailUpdateDto = {
        confirmationToken: 'test-token-123',
        otp: '123456',
      };

      const mockRequestUser = {
        id: '1',
        username: 'omarhassan',
      } as RequestUser;

      const expectedResult = { message: 'Email address updated successfully.' };

      mockSettingsService.verifyEmailUpdate.mockResolvedValue(expectedResult);

      const result = await controller.verifyUpdateEmailOtp(dto, mockRequestUser);

      expect(mockSettingsService.verifyEmailUpdate).toHaveBeenCalledWith(BigInt(1), dto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle invalid OTP', async () => {
      const dto: VerifyEmailUpdateDto = {
        confirmationToken: 'test-token-123',
        otp: 'wrongotp',
      };
      const error = new Error('Invalid OTP');

      const mockRequestUser = {
        id: '1',
        username: 'omarhassan',
      } as RequestUser;

      mockSettingsService.verifyEmailUpdate.mockRejectedValue(error);

      await expect(controller.verifyUpdateEmailOtp(dto, mockRequestUser)).rejects.toThrow(error);
    });

    it('should handle invalid confirmation token', async () => {
      const dto: VerifyEmailUpdateDto = {
        confirmationToken: 'invalid-token',
        otp: '123456',
      };
      const error = new Error('Invalid token');

      const mockRequestUser = {
        id: '1',
        username: 'omarhassan',
      } as RequestUser;

      mockSettingsService.verifyEmailUpdate.mockRejectedValue(error);

      await expect(controller.verifyUpdateEmailOtp(dto, mockRequestUser)).rejects.toThrow(error);
    });
  });

  describe('resendUpdateEmailOtp', () => {
    it('should resend email update OTP successfully', async () => {
      const dto: ResendEmailUpdateOtp = {
        confirmationToken: 'test-token-123',
      };

      const mockRequestUser = {
        id: '1',
        username: 'omarhassan',
      } as RequestUser;

      const expectedResult = { message: 'OTP resent successfully' };

      mockSettingsService.resendEmailUpdateOtp.mockResolvedValue(expectedResult);

      const result = await controller.resendUpdateEmailOtp(dto, mockRequestUser);

      expect(mockSettingsService.resendEmailUpdateOtp).toHaveBeenCalledWith(BigInt(1), dto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors when resending OTP', async () => {
      const dto: ResendEmailUpdateOtp = {
        confirmationToken: 'invalid-token',
      };
      const error = new Error('Token expired');

      const mockRequestUser = {
        id: '1',
        username: 'omarhassan',
      } as RequestUser;

      mockSettingsService.resendEmailUpdateOtp.mockRejectedValue(error);

      await expect(controller.resendUpdateEmailOtp(dto, mockRequestUser)).rejects.toThrow(error);
    });

    it('should handle rate limiting scenarios', async () => {
      const dto: ResendEmailUpdateOtp = {
        confirmationToken: 'test-token-123',
      };
      const error = new Error('Too many requests');

      const mockRequestUser = {
        id: '1',
        username: 'omarhassan',
      } as RequestUser;

      mockSettingsService.resendEmailUpdateOtp.mockRejectedValue(error);

      await expect(controller.resendUpdateEmailOtp(dto, mockRequestUser)).rejects.toThrow(error);
    });
  });

  describe('controller constants', () => {
    it('should have correct EMAIL_UPDATE_LIMIT', () => {
      expect(SettingsController['EMAIL_UPDATE_LIMIT']).toBe(5);
    });

    it('should have correct EMAIL_UPDATE_WINDOW', () => {
      expect(SettingsController['EMAIL_UPDATE_WINDOW']).toBe(60000);
    });
  });

  describe('updateUsername', () => {
    it('should successfully update username', async () => {
      const dto = { newUsername: 'newusername' };
      const expectedResult = { message: 'Username updated successfully.' };

      mockSettingsService.updateUsername.mockResolvedValue(expectedResult);

      const mockRequestUser = {
        id: '1',
        username: 'oldusername',
      } as RequestUser;

      const result = await controller.updateUsername(dto, mockRequestUser);

      expect(mockSettingsService.updateUsername).toHaveBeenCalledWith(BigInt(1), dto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle case-only username changes', async () => {
      const dto = { newUsername: 'OldUsername' };
      const expectedResult = { message: 'Username updated successfully.' };

      mockSettingsService.updateUsername.mockResolvedValue(expectedResult);

      const mockRequestUser = {
        id: '1',
        username: 'oldusername',
      } as RequestUser;

      const result = await controller.updateUsername(dto, mockRequestUser);

      expect(mockSettingsService.updateUsername).toHaveBeenCalledWith(BigInt(1), dto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw conflict when username is taken', async () => {
      const dto = { newUsername: 'takenusername' };
      const error = new Error('Username already in use');

      const mockRequestUser = {
        id: '1',
        username: 'oldusername',
      } as RequestUser;

      mockSettingsService.updateUsername.mockRejectedValue(error);

      await expect(controller.updateUsername(dto, mockRequestUser)).rejects.toThrow(error);
    });

    it('should convert string user ID to BigInt', async () => {
      const dto = { newUsername: 'newusername' };

      const mockRequestUser = {
        id: '999',
        username: 'testuser',
      } as RequestUser;

      mockSettingsService.updateUsername.mockResolvedValue({
        message: 'Username updated successfully.',
      });

      await controller.updateUsername(dto, mockRequestUser);

      expect(mockSettingsService.updateUsername).toHaveBeenCalledWith(BigInt(999), dto);
    });
  });

  describe('getUserDetails', () => {
    it('should get user details successfully', async () => {
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const expectedResult = {
        username: 'testuser',
        email: 'test@example.com',
        accountCreationDate: new Date(),
        accountCreationIp: '127.0.0.1',
        country: 'Egypt',
        languages: ['EN'],
        gender: 'Male',
        birthDate: '1990-01-01',
        age: 34,
      };

      mockSettingsService.getUserDetails.mockResolvedValue(expectedResult);

      const result = await controller.getUserDetails(mockRequestUser);

      expect(mockSettingsService.getUserDetails).toHaveBeenCalledWith(BigInt(1));
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateBirthDate', () => {
    it('should update birth date successfully', async () => {
      const dto = { date: new Date('1995-05-15') };
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const expectedResult = { message: 'Birth date updated successfully.' };
      mockSettingsService.updateBirthDate.mockResolvedValue(expectedResult);

      const result = await controller.updateBirthDate(dto, mockRequestUser);

      expect(mockSettingsService.updateBirthDate).toHaveBeenCalledWith(BigInt(1), dto.date);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getUserSSOs', () => {
    it('should get user SSOs successfully', async () => {
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const expectedResult = [
        {
          provider: 'google',
          displayIdentifier: 'test@gmail.com',
          status: 'Connected',
          connectedAt: new Date(),
        },
      ];

      mockSettingsService.getUserSSOs.mockResolvedValue(expectedResult);

      const result = await controller.getUserSSOs(mockRequestUser);

      expect(mockSettingsService.getUserSSOs).toHaveBeenCalledWith(BigInt(1));
      expect(result).toEqual(expectedResult);
    });
  });

  describe('removeUserSSO', () => {
    it('should remove user SSO successfully', async () => {
      const dto = { currentPassword: 'password123' };
      const provider = 'google';
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const expectedResult = { message: 'Account disconnected successfully.' };
      mockSettingsService.removeUserSSO.mockResolvedValue(expectedResult);

      const result = await controller.removeUserSSO(dto, provider, mockRequestUser);

      expect(mockSettingsService.removeUserSSO).toHaveBeenCalledWith(
        BigInt(1),
        provider,
        dto.currentPassword,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw error for invalid provider', async () => {
      const dto = { currentPassword: 'password123' };
      const provider = 'invalid-provider';
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      await expect(controller.removeUserSSO(dto, provider, mockRequestUser)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getCountries', () => {
    it('should get countries successfully', async () => {
      const expectedResult = [
        { code: 'EG', name: 'Egypt' },
        { code: 'US', name: 'United States' },
      ];

      mockSettingsService.getCountries.mockResolvedValue(expectedResult);

      const result = await controller.getCountries();

      expect(mockSettingsService.getCountries).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('changeCountry', () => {
    it('should change country successfully', async () => {
      const dto = { countryName: 'Egypt' };
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const expectedResult = { message: 'Country updated successfully.' };
      mockSettingsService.changeCountry.mockResolvedValue(expectedResult);

      const result = await controller.changeCountry(dto, mockRequestUser);

      expect(mockSettingsService.changeCountry).toHaveBeenCalledWith(BigInt(1), dto.countryName);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('changeGender', () => {
    it('should change gender to Male successfully', async () => {
      const dto = { gender: 'Male' };
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const expectedResult = { message: 'Gender updated successfully.' };
      mockSettingsService.updateGender.mockResolvedValue(expectedResult);

      const result = await controller.changeGender(dto, mockRequestUser);

      expect(mockSettingsService.updateGender).toHaveBeenCalledWith(BigInt(1), dto.gender);
      expect(result).toEqual(expectedResult);
    });

    it('should change gender to Female successfully', async () => {
      const dto = { gender: 'Female' };
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const expectedResult = { message: 'Gender updated successfully.' };
      mockSettingsService.updateGender.mockResolvedValue(expectedResult);

      const result = await controller.changeGender(dto, mockRequestUser);

      expect(mockSettingsService.updateGender).toHaveBeenCalledWith(BigInt(1), dto.gender);
      expect(result).toEqual(expectedResult);
    });

    it('should throw error for invalid gender', async () => {
      const dto = { gender: 'Other' };
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      await expect(controller.changeGender(dto, mockRequestUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateLanguage', () => {
    it('should update language to AR successfully', async () => {
      const dto = { language: 'AR' };
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const expectedResult = { message: 'Default language updated successfully.' };
      mockSettingsService.updateLanguage.mockResolvedValue(expectedResult);

      const result = await controller.updateLanguage(dto, mockRequestUser);

      expect(mockSettingsService.updateLanguage).toHaveBeenCalledWith(BigInt(1), dto.language);
      expect(result).toEqual(expectedResult);
    });

    it('should update language to EN successfully', async () => {
      const dto = { language: 'EN' };
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const expectedResult = { message: 'Default language updated successfully.' };
      mockSettingsService.updateLanguage.mockResolvedValue(expectedResult);

      const result = await controller.updateLanguage(dto, mockRequestUser);

      expect(mockSettingsService.updateLanguage).toHaveBeenCalledWith(BigInt(1), dto.language);
      expect(result).toEqual(expectedResult);
    });

    it('should throw error for invalid language', async () => {
      const dto = { language: 'FR' };
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      await expect(controller.updateLanguage(dto, mockRequestUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validatePassword', () => {
    it('should validate password successfully', async () => {
      const dto = { password: 'correctPassword123' };
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const expectedResult = { isValid: true };
      mockSettingsService.validatePassword.mockResolvedValue(expectedResult);

      const result = await controller.validatePassword(dto, mockRequestUser);

      expect(mockSettingsService.validatePassword).toHaveBeenCalledWith(BigInt(1), dto.password);
      expect(result).toEqual(expectedResult);
    });

    it('should return false for invalid password', async () => {
      const dto = { password: 'wrongPassword' };
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const expectedResult = { isValid: false };
      mockSettingsService.validatePassword.mockResolvedValue(expectedResult);

      const result = await controller.validatePassword(dto, mockRequestUser);

      expect(mockSettingsService.validatePassword).toHaveBeenCalledWith(BigInt(1), dto.password);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getSessions', () => {
    it('should get sessions with refresh token from cookies', async () => {
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const mockRequest = {
        cookies: {
          refreshToken: 'valid-refresh-token',
        },
      } as unknown as RequestWithCookies;

      const expectedResult = [
        {
          id: BigInt(1),
          deviceType: 'Web',
          lastActive: new Date(),
          isCurrent: true,
        },
      ];

      mockSettingsService.getSessions.mockResolvedValue(expectedResult);

      const result = await controller.getSessions(mockRequestUser, undefined, mockRequest);

      expect(mockSettingsService.getSessions).toHaveBeenCalledWith(
        BigInt(1),
        'valid-refresh-token',
      );
      expect(result).toEqual(expectedResult);
    });

    it('should get sessions with refresh token from body', async () => {
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const mockRequest = {
        cookies: {},
      } as unknown as RequestWithCookies;

      const refreshTokenDto = { refreshToken: 'valid-refresh-token-from-body' };

      const expectedResult = [
        {
          id: BigInt(1),
          deviceType: 'Mobile',
          lastActive: new Date(),
          isCurrent: true,
        },
      ];

      mockSettingsService.getSessions.mockResolvedValue(expectedResult);

      const result = await controller.getSessions(mockRequestUser, refreshTokenDto, mockRequest);

      expect(mockSettingsService.getSessions).toHaveBeenCalledWith(
        BigInt(1),
        'valid-refresh-token-from-body',
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw error when no refresh token provided', async () => {
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const mockRequest = {
        cookies: {},
      } as unknown as RequestWithCookies;

      await expect(controller.getSessions(mockRequestUser, undefined, mockRequest)).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw error when refresh token validation fails', async () => {
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const mockRequest = {
        cookies: {},
      } as unknown as RequestWithCookies;

      const invalidDto = { refreshToken: '' }; // Invalid, will fail validation

      await expect(
        controller.getSessions(mockRequestUser, invalidDto, mockRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteSession', () => {
    it('should delete session with refresh token from cookies', async () => {
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const mockRequest = {
        cookies: {
          refreshToken: 'valid-refresh-token',
        },
      } as unknown as RequestWithCookies;

      const sessionId = '2';

      const expectedResult = { message: 'Session terminated successfully.' };
      mockSettingsService.deleteSession.mockResolvedValue(expectedResult);

      const result = await controller.deleteSession(
        mockRequestUser,
        sessionId,
        undefined,
        mockRequest,
      );

      expect(mockSettingsService.deleteSession).toHaveBeenCalledWith(
        BigInt(1),
        BigInt(2),
        'valid-refresh-token',
      );
      expect(result).toEqual(expectedResult);
    });

    it('should delete session with refresh token from body', async () => {
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const mockRequest = {
        cookies: {},
      } as unknown as RequestWithCookies;

      const sessionId = '3';
      const refreshTokenDto = { refreshToken: 'valid-refresh-token-from-body' };

      const expectedResult = { message: 'Session terminated successfully.' };
      mockSettingsService.deleteSession.mockResolvedValue(expectedResult);

      const result = await controller.deleteSession(
        mockRequestUser,
        sessionId,
        refreshTokenDto,
        mockRequest,
      );

      expect(mockSettingsService.deleteSession).toHaveBeenCalledWith(
        BigInt(1),
        BigInt(3),
        'valid-refresh-token-from-body',
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw error when no refresh token provided for delete', async () => {
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const mockRequest = {
        cookies: {},
      } as unknown as RequestWithCookies;

      const sessionId = '2';

      await expect(
        controller.deleteSession(mockRequestUser, sessionId, undefined, mockRequest),
      ).rejects.toThrow(HttpException);
    });

    it('should throw error when refresh token validation fails for delete', async () => {
      const mockRequestUser = {
        id: '1',
        username: 'testuser',
      } as RequestUser;

      const mockRequest = {
        cookies: {},
      } as unknown as RequestWithCookies;

      const sessionId = '2';
      const invalidDto = { refreshToken: '' }; // Invalid, will fail validation

      await expect(
        controller.deleteSession(mockRequestUser, sessionId, invalidDto, mockRequest),
      ).rejects.toThrow(HttpException);
    });
  });
  describe('GET /users/me/settings/blocks', () => {
    const mockUser = { id: '1' };

    it('should return blocks with default limit (20) when no limit provided', async () => {
      // Arrange
      const mockServiceResult = {
        items: [
          {
            username: 'blocked1',
            displayName: 'Blocked One',
          },
          {
            username: 'blocked2',
            displayName: 'Blocked Two',
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: 'abc123',
          hasNextPage: true,
        },
      };

      mockSettingsService.getUserBlockedUsers.mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserBlockedUsers(mockUser, undefined, undefined);

      // Assert
      expect(mockSettingsService.getUserBlockedUsers).toHaveBeenCalledWith(
        BigInt(1),
        20, // default limit
        undefined, // no cursor
      );
      expect(result.items).toHaveLength(2);
      expect(result.pagination).toEqual(mockServiceResult.pagination);
    });

    it('should return blocked users with custom limit when provided', async () => {
      // Arrange
      const customLimit = '10';
      const mockServiceResult = {
        items: [
          {
            username: 'blocked1',
            displayName: 'Blocked One',
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      mockSettingsService.getUserBlockedUsers.mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserBlockedUsers(mockUser, customLimit, undefined);

      // Assert
      expect(mockSettingsService.getUserBlockedUsers).toHaveBeenCalledWith(
        BigInt(1),
        10, // custom limit parsed
        undefined,
      );
      expect(result.items).toHaveLength(1);
    });

    it('should return blocked users with cursor for pagination', async () => {
      // Arrange
      const cursor = 'eyJmb2xsb3dlcklkIjoiMiIsImZvbGxvd2VkSWQiOiIxIn0='; // base64 encoded cursor
      const mockServiceResult = {
        items: [
          {
            username: 'blocked3',
            displayName: 'Blocked Three',
          },
        ],
        pagination: {
          cursor,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      mockSettingsService.getUserBlockedUsers.mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserBlockedUsers(mockUser, undefined, cursor);

      // Assert
      expect(mockSettingsService.getUserBlockedUsers).toHaveBeenCalledWith(
        BigInt(1),
        20,
        cursor, // cursor passed through
      );
      expect(result.pagination.cursor).toBe(cursor);
    });

    it('should use default limit (20) when invalid limit provided', async () => {
      // Arrange
      const invalidLimits = ['invalid', '-5', '0', 'NaN', ''];
      const mockServiceResult = {
        items: [],
        pagination: { cursor: null, nextCursor: null, hasNextPage: false },
      };

      mockSettingsService.getUserBlockedUsers.mockResolvedValue(mockServiceResult);

      // Act & Assert
      for (const invalidLimit of invalidLimits) {
        await controller.getUserBlockedUsers(mockUser, invalidLimit, undefined);

        expect(mockSettingsService.getUserBlockedUsers).toHaveBeenCalledWith(
          BigInt(1),
          20, // default limit used for invalid values
          undefined,
        );
      }
    });

    it('should transform items to CompactUserDto instances', async () => {
      // Arrange
      const mockServiceResult = {
        items: [
          {
            username: 'blocked1',
            displayName: 'Blocked One',
          },
          {
            username: 'blocked2',
            displayName: 'Blocked Two',
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      mockSettingsService.getUserBlockedUsers.mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserBlockedUsers(mockUser, undefined, undefined);

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toHaveProperty('username', 'blocked1');
      expect(result.items[0]).toHaveProperty('displayName', 'Blocked One');
    });

    it('should return empty items array when user has no blocked users', async () => {
      // Arrange
      const mockServiceResult = {
        items: [],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      mockSettingsService.getUserBlockedUsers.mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserBlockedUsers(mockUser, undefined, undefined);

      // Assert
      expect(mockSettingsService.getUserBlockedUsers).toHaveBeenCalledWith(
        BigInt(1),
        20,
        undefined,
      );
      expect(result.items).toEqual([]);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should handle large limit values correctly', async () => {
      // Arrange
      const largeLimit = '100';
      const mockServiceResult = {
        items: new Array(100).fill(null).map((_, i) => ({
          username: `blocked${i}`,
          displayName: `Blocked ${i}`,
        })),
        pagination: {
          cursor: null,
          nextCursor: 'nextpage',
          hasNextPage: true,
        },
      };

      mockSettingsService.getUserBlockedUsers.mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserBlockedUsers(mockUser, largeLimit, undefined);

      // Assert
      expect(mockSettingsService.getUserBlockedUsers).toHaveBeenCalledWith(
        BigInt(1),
        100,
        undefined,
      );
      expect(result.items).toHaveLength(100);
    });

    it('should pass through service errors (user not found)', async () => {
      // Arrange
      const error = new Error('User not found');
      mockSettingsService.getUserBlockedUsers.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getUserBlockedUsers(mockUser, undefined, undefined)).rejects.toThrow(
        'User not found',
      );
    });

    it('should pass through service errors (invalid cursor)', async () => {
      // Arrange
      const invalidCursor = 'invalid!!!';
      const error = new Error('Invalid cursor format');
      mockSettingsService.getUserBlockedUsers.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getUserBlockedUsers(mockUser, undefined, invalidCursor),
      ).rejects.toThrow('Invalid cursor format');
    });

    it('should correctly convert user id string to BigInt', async () => {
      // Arrange
      const largeUserId = '9007199254740991'; // max safe integer
      const mockServiceResult = {
        items: [],
        pagination: { cursor: null, nextCursor: null, hasNextPage: false },
      };

      mockSettingsService.getUserBlockedUsers.mockResolvedValue(mockServiceResult);

      // Act
      await controller.getUserBlockedUsers({ id: largeUserId }, undefined, undefined);

      // Assert
      expect(mockSettingsService.getUserBlockedUsers).toHaveBeenCalledWith(
        BigInt(largeUserId),
        20,
        undefined,
      );
    });
  });
});
