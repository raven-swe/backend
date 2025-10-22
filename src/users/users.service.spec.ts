import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

describe('UsersService', () => {
  let service: UsersService;

  const mockEmailQueue = {
    add: jest.fn(),
    close: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [
        Logger,
        { provide: UsersRepository, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: UsersService, useClass: UsersService },
        { provide: getQueueToken('email'), useValue: mockEmailQueue },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
