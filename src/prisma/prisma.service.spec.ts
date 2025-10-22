import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'DATABASE_URL') return 'mock-database-url';
    return null;
  }),
};

const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [PrismaService, Logger],
      providers: [
        PrismaService,
        { provide: Logger, useValue: mockLogger },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await service.$disconnect();
  afterAll(() => {
    processExitSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(mockConfigService.get).toHaveBeenCalledWith('DATABASE_URL');
  });

  describe('onMobuleInit success', () => {
    let connectSpy: jest.SpyInstance;

    beforeEach(async () => {
      connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should call $connect', () => {
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('should log a success message', () => {
      expect(mockLogger.log).toHaveBeenCalledWith('Database connected');
    });

    it('should not log an error', () => {
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should not exit the process', () => {
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });
  describe('onModuleInit (failure)', () => {
    let connectSpy: jest.SpyInstance;
    const mockError = new Error('Connection failed');
    mockError.stack = 'mock stack trace';

    beforeEach(async () => {
      connectSpy = jest.spyOn(service, '$connect').mockRejectedValue(mockError);
      await service.onModuleInit();
    });

    it('should attempt to connect', () => {
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('should not log a success message', () => {
      expect(mockLogger.log).not.toHaveBeenCalled();
    });

    it('should log the error stack', () => {
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database connection error',
        'mock stack trace',
      );
    });

    it('should exit the process with code 1', () => {
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('onModuleInit (failure with non-Error)', () => {
    beforeEach(async () => {
      jest.spyOn(service, '$connect').mockRejectedValue('A string error');
      await service.onModuleInit();
    });

    it('should log the stringified error', () => {
      expect(mockLogger.error).toHaveBeenCalledWith('Database connection error', 'A string error');
    });

    it('should exit the process with code 1', () => {
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
