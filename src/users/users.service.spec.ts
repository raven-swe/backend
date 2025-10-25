import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { NewUser } from './interfaces/NewUser.interface';
import { LanguageCode } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let mockUsersRepository: Partial<UsersRepository>;

  beforeEach(async () => {
    mockUsersRepository = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      findByIdentifier: jest.fn(),
      findByUsername: jest.fn(),
      updatePasswordById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findByUsername', () => {
    const mockUser = { id: BigInt(1), email: 'test@gmail.com', username: 'testuser' };

    it('should call the repository with the correct username and return its result', async () => {
      const username = 'testuser';
      (mockUsersRepository.findByUsername as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByUsername(username);

      expect(mockUsersRepository.findByUsername).toHaveBeenCalledWith(username);
      expect(result).toBe(mockUser);
    });
  });

  describe('findByIdentifier', () => {
    const mockUser = { id: BigInt(1), email: 'test@gmail.com', username: 'testuser' };

    it('should call the repository with the correct identifier and return its result', async () => {
      const identifier = 'testuser';
      (mockUsersRepository.findByIdentifier as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByIdentifier(identifier);

      expect(mockUsersRepository.findByIdentifier).toHaveBeenCalledWith(identifier);
      expect(result).toBe(mockUser);
    });
  });

  describe('updatePasswordById', () => {
    it('should call the repository with the correct userId and new password hash', async () => {
      const userId = BigInt(1);
      const newHashedPassword = 'newHashedPassword123';
      const expectedUpdatedUser = { id: userId, password_hash: newHashedPassword };

      (mockUsersRepository.updatePasswordById as jest.Mock).mockResolvedValue(expectedUpdatedUser);

      const result = await service.updatePasswordById(userId, newHashedPassword);

      expect(mockUsersRepository.updatePasswordById).toHaveBeenCalledWith(
        userId,
        newHashedPassword,
      );
      expect(result).toEqual(expectedUpdatedUser);
    });
  });

  describe('findByEmail', () => {
    it('should call the repository with the correct email and return its result', async () => {
      const email = 'test@gmail.com';
      const expectedUser = { id: BigInt(1), email, password_hash: '...' };
      (mockUsersRepository.findByEmail as jest.Mock).mockResolvedValue(expectedUser);

      const result = await service.findByEmail(email);

      expect(mockUsersRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(result).toBe(expectedUser);
    });
  });

  describe('createUser', () => {
    it('should call the repository with the correct user data and return the new user', async () => {
      const newUserDto: NewUser = {
        email: 'test@gmail.com',
        username: 'omar',
        name: 'Omar Gamal',
        passwordHash: 'hashedpassword',
        birthDate: new Date(),
        languageCode: LanguageCode.EN,
      };
      const expectedCreatedUser = { id: BigInt(2), ...newUserDto };
      (mockUsersRepository.createUser as jest.Mock).mockResolvedValue(expectedCreatedUser);

      const result = await service.createUser(newUserDto, {} as never);

      expect(mockUsersRepository.createUser).toHaveBeenCalledWith(newUserDto, {} as never);
      expect(result).toBe(expectedCreatedUser);
    });
  });
});
