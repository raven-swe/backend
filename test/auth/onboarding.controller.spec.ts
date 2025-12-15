import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingController } from 'src/auth/onboarding.controller';
import { UsersRepository } from 'src/users/users.repository';
import { ONBOARDING_CONSTANTS } from 'src/auth/constants';
import type { RequestUser } from 'src/common/interfaces';

describe('OnboardingController', () => {
  let controller: OnboardingController;
  let usersRepository: jest.Mocked<UsersRepository>;

  const mockUsersRepository = {
    getOnboardingFollowSuggestions: jest.fn(),
    getUserEmailAndDisplayName: jest.fn(),
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

  describe('getFollowSuggestions', () => {
    const mockUser: RequestUser = {
      id: '123',
      username: 'testuser',
    };

    const mockSuggestions = [
      { id: BigInt(1), username: 'user1', profile: { displayName: 'User One' } },
      { id: BigInt(2), username: 'user2', profile: { displayName: 'User Two' } },
      { id: BigInt(3), username: 'user3', profile: { displayName: 'User Three' } },
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
        username: 'bigiduser',
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
