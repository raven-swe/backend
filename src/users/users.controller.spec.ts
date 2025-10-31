import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RequestUser } from 'src/auth/types';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    getUserProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /users/:username/profile', () => {
    it('should call usersService.getUserProfile with correct parameters', async () => {
      // Arrange
      const username = 'john_doe';
      const currentUserId = BigInt(1);
      const expectedResult = {
        displayName: 'John Doe',
        bio: 'A sample user',
      };
      const mockUser = { id: currentUserId, username: username } as unknown as RequestUser;

      mockUsersService.getUserProfile.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getUserProfile(username, mockUser);

      // Assert
      expect(mockUsersService.getUserProfile).toHaveBeenCalledWith(username, currentUserId);
      expect(mockUsersService.getUserProfile).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });
  });
});
