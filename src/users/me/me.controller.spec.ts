import { Test, TestingModule } from '@nestjs/testing';
import { MeController } from './me.controller';
import { UsersService } from '../users.service';
import { ChangePasswordBasicDto } from '../dtos/change-password-basic.dto';

describe('MeController', () => {
  let controller: MeController;

  const mockUsersService = {
    changePassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<MeController>(MeController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('PUT /me/password', () => {
    const changePasswordDto: ChangePasswordBasicDto = {
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    };

    it('should call usersService.changePassword with correct parameters', async () => {
      // Arrange
      const expectedUserId = BigInt(18);
      const expectedResult = { message: 'Password changed successfully' };

      mockUsersService.changePassword.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.changePassword(changePasswordDto);

      // Assert
      expect(mockUsersService.changePassword).toHaveBeenCalledWith(
        expectedUserId,
        changePasswordDto,
      );
      expect(mockUsersService.changePassword).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should return the result from usersService.changePassword', async () => {
      const mockResponse = {
        success: true,
        message: 'Password updated successfully',
      };

      mockUsersService.changePassword.mockResolvedValue(mockResponse);

      const result = await controller.changePassword(changePasswordDto);

      expect(result).toEqual(mockResponse);
    });

    it('should handle errors thrown by usersService.changePassword', async () => {
      const error = new Error('Invalid old password');

      mockUsersService.changePassword.mockRejectedValue(error);

      await expect(controller.changePassword(changePasswordDto)).rejects.toThrow(
        'Invalid old password',
      );
      expect(mockUsersService.changePassword).toHaveBeenCalledTimes(1);
    });
  });
});
