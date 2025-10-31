import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    muteUser: jest.fn(),
    unmuteUser: jest.fn(),
  };

  const mockUsersRepository = {
    findByUsername: jest.fn(),
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    isFollowing: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    muteUser: jest.fn(),
    unmuteUser: jest.fn(),
    isMuted: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: UsersRepository, useValue: mockUsersRepository },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
g  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
