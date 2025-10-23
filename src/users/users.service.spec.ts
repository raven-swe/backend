import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { NewUser } from './interfaces/NewUser.interface';
import { LanguageCode } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let mockUsersRepository: Partial<UsersRepository>;

  beforeEach(async () => {
    mockUsersRepository = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
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
        passwordHash: 'hashedpassword',
        birthDate: new Date(),
        languageCode: LanguageCode.EN,
      };
      const expectedCreatedUser = { id: BigInt(2), ...newUserDto };
      (mockUsersRepository.createUser as jest.Mock).mockResolvedValue(expectedCreatedUser);

      const result = await service.createUser(newUserDto, {} as any);

      expect(mockUsersRepository.createUser).toHaveBeenCalledWith(newUserDto, {} as any);
      expect(result).toBe(expectedCreatedUser);
    });
  });
});
