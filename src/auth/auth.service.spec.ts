import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
describe('AuthService', () => {
  let service: AuthService;
  let queue: Queue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.registerQueue({
          name: 'email',
        }),
      ],
      providers: [
        AuthService,
        Logger,
        { provide: RedisService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: RecaptchaService, useValue: {} },
        { provide: getQueueToken('email'), useValue: { add: jest.fn(), close: jest.fn() } },
      ],
    }).compile();

    queue = module.get(getQueueToken('email'));
    service = module.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    await queue.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
