import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingController } from 'src/auth/onboarding.controller';
import { UsersRepository } from 'src/users/users.repository';
import { ONBOARDING_CONSTANTS } from 'src/auth/constants';
import type { RequestUser } from 'src/common/interfaces';
import { HttpException, HttpStatus } from '@nestjs/common';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/users/constants';
import * as commonUtils from 'src/common/utils';

jest.mock('src/common/utils', () => ({
  generateUsernames: jest.fn(),
}));

describe('OnboardingController', () => {
  let controller: OnboardingController;
  let usersRepository: jest.Mocked<UsersRepository>;

  const mockUsersRepository = {
    getOnboardingFollowSuggestions: jest.fn(),
    getUserEmailAndDisplayName: jest.fn(),
    getUserByUsername: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    controller = module.get<OnboardingController>(OnboardingController);
    usersRepository = module.get(UsersRepository);

    jest.clearAllMocks();
  });

  describe('getUsernameSuggestions', () => {
    const mockUser: RequestUser = {
      id: '123',
    };

    const mockExistingUser = {
      email: 'test@example.com',
      profile: {
        displayName: 'Test User',
      },
    };

    it('should return username suggestions with display name', async () => {
      const mockSuggestions = ['testuser1', 'testuser2', 'testuser3'];
      usersRepository.getUserEmailAndDisplayName.mockResolvedValue(mockExistingUser);
      (commonUtils.generateUsernames as jest.Mock).mockResolvedValue(mockSuggestions);

      const result = await controller.getUsernameSuggestions(mockUser);

      expect(result).toEqual({ suggestions: mockSuggestions });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getUserEmailAndDisplayName).toHaveBeenCalledWith(BigInt(123));
      expect(commonUtils.generateUsernames).toHaveBeenCalledWith(
        usersRepository,
        'Test User',
        'test@example.com',
        undefined,
        ONBOARDING_CONSTANTS.USERNAME_SUGGESTIONS_COUNT,
        false,
      );
    });

    it('should return username suggestions with typed parameter', async () => {
      const mockSuggestions = ['myname1', 'myname2', 'myname3'];
      const typed = 'myname';
      usersRepository.getUserEmailAndDisplayName.mockResolvedValue(mockExistingUser);
      (commonUtils.generateUsernames as jest.Mock).mockResolvedValue(mockSuggestions);

      const result = await controller.getUsernameSuggestions(mockUser, typed);

      expect(result).toEqual({ suggestions: mockSuggestions });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getUserEmailAndDisplayName).toHaveBeenCalledWith(BigInt(123));
      expect(commonUtils.generateUsernames).toHaveBeenCalledWith(
        usersRepository,
        'Test User',
        'test@example.com',
        'myname',
        ONBOARDING_CONSTANTS.USERNAME_SUGGESTIONS_COUNT,
        false,
      );
    });

    it('should handle user with no profile (empty display name)', async () => {
      const mockSuggestions = ['test1', 'test2', 'test3'];
      const userWithoutProfile = {
        email: 'test@example.com',
        profile: null,
      };
      usersRepository.getUserEmailAndDisplayName.mockResolvedValue(userWithoutProfile);
      (commonUtils.generateUsernames as jest.Mock).mockResolvedValue(mockSuggestions);

      const result = await controller.getUsernameSuggestions(mockUser);

      expect(result).toEqual({ suggestions: mockSuggestions });
      expect(commonUtils.generateUsernames).toHaveBeenCalledWith(
        usersRepository,
        '',
        'test@example.com',
        undefined,
        ONBOARDING_CONSTANTS.USERNAME_SUGGESTIONS_COUNT,
        false,
      );
    });

    it('should handle user with profile but no display name', async () => {
      const mockSuggestions = ['test1', 'test2', 'test3'];
      const userWithNoDisplayName = {
        email: 'test@example.com',
        profile: {
          displayName: '',
        },
      };
      usersRepository.getUserEmailAndDisplayName.mockResolvedValue(userWithNoDisplayName);
      (commonUtils.generateUsernames as jest.Mock).mockResolvedValue(mockSuggestions);

      const result = await controller.getUsernameSuggestions(mockUser);

      expect(result).toEqual({ suggestions: mockSuggestions });
      expect(commonUtils.generateUsernames).toHaveBeenCalledWith(
        usersRepository,
        '',
        'test@example.com',
        undefined,
        ONBOARDING_CONSTANTS.USERNAME_SUGGESTIONS_COUNT,
        false,
      );
    });

    it('should throw UNAUTHORIZED exception when user not found', async () => {
      usersRepository.getUserEmailAndDisplayName.mockResolvedValue(null);

      await expect(controller.getUsernameSuggestions(mockUser)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.UNAUTHORIZED,
        ),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getUserEmailAndDisplayName).toHaveBeenCalledWith(BigInt(123));
      expect(commonUtils.generateUsernames).not.toHaveBeenCalled();
    });

    it('should correctly convert user id to BigInt', async () => {
      const mockSuggestions = ['testuser1', 'testuser2', 'testuser3'];
      const userWithBigId: RequestUser = {
        id: '999999999999',
      };
      usersRepository.getUserEmailAndDisplayName.mockResolvedValue(mockExistingUser);
      (commonUtils.generateUsernames as jest.Mock).mockResolvedValue(mockSuggestions);

      await controller.getUsernameSuggestions(userWithBigId);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getUserEmailAndDisplayName).toHaveBeenCalledWith(
        BigInt('999999999999'),
      );
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database error');
      usersRepository.getUserEmailAndDisplayName.mockRejectedValue(error);

      await expect(controller.getUsernameSuggestions(mockUser)).rejects.toThrow('Database error');
    });
  });

  describe('getFollowSuggestions', () => {
    const mockUser: RequestUser = {
      id: '123',
    };

    const mockSuggestions = [
      {
        id: '1',
        username: 'user1',
        displayName: 'User One',
        avatarUrl: null,
        bio: null,
        bioEntities: null,
        relationship: { isFollower: false },
      },
      {
        id: '2',
        username: 'user2',
        displayName: 'User Two',
        avatarUrl: null,
        bio: null,
        bioEntities: null,
        relationship: { isFollower: false },
      },
      {
        id: '3',
        username: 'user3',
        displayName: 'User Three',
        avatarUrl: null,
        bio: null,
        bioEntities: null,
        relationship: { isFollower: false },
      },
    ];

    it('should return follow suggestions with default limit', async () => {
      usersRepository.getOnboardingFollowSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getFollowSuggestions(mockUser);

      expect(result).toEqual({ suggestions: mockSuggestions });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getOnboardingFollowSuggestions).toHaveBeenCalledWith(
        BigInt(123),
        ONBOARDING_CONSTANTS.MAX_FOLLOW_SUGGESTIONS_COUNT,
      );
    });

    it('should return follow suggestions with custom valid limit', async () => {
      const customLimit = '10';
      usersRepository.getOnboardingFollowSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getFollowSuggestions(mockUser, customLimit);

      expect(result).toEqual({ suggestions: mockSuggestions });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getOnboardingFollowSuggestions).toHaveBeenCalledWith(BigInt(123), 10);
    });

    it('should cap limit at MAX_FOLLOW_SUGGESTIONS_COUNT when limit exceeds maximum', async () => {
      const exceedingLimit = '100';
      usersRepository.getOnboardingFollowSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getFollowSuggestions(mockUser, exceedingLimit);

      expect(result).toEqual({ suggestions: mockSuggestions });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getOnboardingFollowSuggestions).toHaveBeenCalledWith(
        BigInt(123),
        ONBOARDING_CONSTANTS.MAX_FOLLOW_SUGGESTIONS_COUNT,
      );
    });

    it('should use default limit when limit is invalid (NaN)', async () => {
      const invalidLimit = 'invalid';
      usersRepository.getOnboardingFollowSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getFollowSuggestions(mockUser, invalidLimit);

      expect(result).toEqual({ suggestions: mockSuggestions });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getOnboardingFollowSuggestions).toHaveBeenCalledWith(
        BigInt(123),
        ONBOARDING_CONSTANTS.MAX_FOLLOW_SUGGESTIONS_COUNT,
      );
    });

    it('should use default limit when limit is zero', async () => {
      const zeroLimit = '0';
      usersRepository.getOnboardingFollowSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getFollowSuggestions(mockUser, zeroLimit);

      expect(result).toEqual({ suggestions: mockSuggestions });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getOnboardingFollowSuggestions).toHaveBeenCalledWith(
        BigInt(123),
        ONBOARDING_CONSTANTS.MAX_FOLLOW_SUGGESTIONS_COUNT,
      );
    });

    it('should use default limit when limit is negative', async () => {
      const negativeLimit = '-5';
      usersRepository.getOnboardingFollowSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getFollowSuggestions(mockUser, negativeLimit);

      expect(result).toEqual({ suggestions: mockSuggestions });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getOnboardingFollowSuggestions).toHaveBeenCalledWith(
        BigInt(123),
        ONBOARDING_CONSTANTS.MAX_FOLLOW_SUGGESTIONS_COUNT,
      );
    });

    it('should handle empty suggestions array', async () => {
      usersRepository.getOnboardingFollowSuggestions.mockResolvedValue([]);

      const result = await controller.getFollowSuggestions(mockUser);

      expect(result).toEqual({ suggestions: [] });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getOnboardingFollowSuggestions).toHaveBeenCalledWith(
        BigInt(123),
        ONBOARDING_CONSTANTS.MAX_FOLLOW_SUGGESTIONS_COUNT,
      );
    });

    it('should correctly convert user id to BigInt', async () => {
      const userWithStringId: RequestUser = {
        id: '999999999999',
      };
      usersRepository.getOnboardingFollowSuggestions.mockResolvedValue(mockSuggestions);

      await controller.getFollowSuggestions(userWithStringId);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getOnboardingFollowSuggestions).toHaveBeenCalledWith(
        BigInt('999999999999'),
        ONBOARDING_CONSTANTS.MAX_FOLLOW_SUGGESTIONS_COUNT,
      );
    });

    it('should handle limit as string "1"', async () => {
      const limit = '1';
      usersRepository.getOnboardingFollowSuggestions.mockResolvedValue([mockSuggestions[0]]);

      const result = await controller.getFollowSuggestions(mockUser, limit);

      expect(result).toEqual({ suggestions: [mockSuggestions[0]] });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersRepository.getOnboardingFollowSuggestions).toHaveBeenCalledWith(BigInt(123), 1);
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database error');
      usersRepository.getOnboardingFollowSuggestions.mockRejectedValue(error);

      await expect(controller.getFollowSuggestions(mockUser)).rejects.toThrow('Database error');
    });
  });
});
