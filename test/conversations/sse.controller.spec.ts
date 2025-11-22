import { Test, TestingModule } from '@nestjs/testing';
import { SseController } from 'src/conversations/sse.controller';
import { SseService } from 'src/conversations/sse.service';
import { JwtAuthGuard } from 'src/auth/guards';
import type { Response } from 'express';
import type { RequestUser } from 'src/common/interfaces';
import { Subject } from 'rxjs';

describe('SseController', () => {
  let controller: SseController;

  const mockSseService = {
    subscribe: jest.fn(),
    publish: jest.fn(),
    unsubscribe: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SseController],
      providers: [
        {
          provide: SseService,
          useValue: mockSseService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SseController>(SseController);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    if (mockSseService.subscribe) {
      mockSseService.subscribe.mockClear();
    }
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('stream', () => {
    type MockResponse = Partial<Response> & { emit: (event: string) => boolean };

    const createMockResponse = (): MockResponse => {
      const listeners: { [event: string]: (() => void)[] } = {};

      return {
        set: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        on: jest.fn((event: string, callback: () => void) => {
          if (!listeners[event]) {
            listeners[event] = [];
          }
          listeners[event].push(callback);
          return {} as Response;
        }),
        emit: jest.fn((event: string): boolean => {
          if (listeners[event]) {
            listeners[event].forEach((cb) => cb());
          }
          return true;
        }),
      };
    };

    const mockUser: RequestUser = {
      id: '123',
    };

    const cleanupConnection = (
      mockRes: Partial<Response> & { emit: (event: string) => boolean },
    ) => {
      mockRes.emit('close');
    };

    it('should return 400 for invalid topics parameter', () => {
      const mockRes = createMockResponse();

      controller.stream(mockUser, mockRes as Response, 'invalid-topic');

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid topics parameter. Only "dm" is supported.',
        code: 'INVALID_TOPICS',
      });
    });

    it('should return 400 when topics parameter is missing', () => {
      const mockRes = createMockResponse();

      controller.stream(mockUser, mockRes as Response, undefined);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid topics parameter. Only "dm" is supported.',
        code: 'INVALID_TOPICS',
      });
    });

    it('should set correct SSE headers for valid request', () => {
      const mockRes = createMockResponse();
      const mockSubject = new Subject();
      mockSseService.subscribe.mockReturnValue(mockSubject.asObservable());

      controller.stream(mockUser, mockRes as Response, 'dm');

      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      expect(mockRes.flushHeaders).toHaveBeenCalled();

      cleanupConnection(mockRes);
      mockSubject.complete();
    });

    it('should send connected event on successful connection', () => {
      const mockRes = createMockResponse();
      const mockSubject = new Subject();
      mockSseService.subscribe.mockReturnValue(mockSubject.asObservable());

      controller.stream(mockUser, mockRes as Response, 'dm');

      expect(mockRes.write).toHaveBeenCalledWith(
        `event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`,
      );

      cleanupConnection(mockRes);
      mockSubject.complete();
    });

    it('should subscribe to SSE service with user ID', () => {
      const mockRes = createMockResponse();
      const mockSubject = new Subject();
      mockSseService.subscribe.mockReturnValue(mockSubject.asObservable());

      controller.stream(mockUser, mockRes as Response, 'dm');

      expect(mockSseService.subscribe).toHaveBeenCalledWith('123');

      cleanupConnection(mockRes);
      mockSubject.complete();
    });

    it('should write event data when SSE service publishes', () => {
      const mockRes = createMockResponse();
      const mockSubject = new Subject();
      mockSseService.subscribe.mockReturnValue(mockSubject.asObservable());

      controller.stream(mockUser, mockRes as Response, 'dm');

      (mockRes.write as jest.Mock).mockClear();

      mockSubject.next({
        event: 'dm.new_message',
        data: { message: 'Hello' },
      });

      expect(mockRes.write).toHaveBeenCalledWith('event: dm.new_message\n');
      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ event: 'test.event', data: { message: 'Hello' } })}\n\n`,
      );

      cleanupConnection(mockRes);
      mockSubject.complete();
    });

    it('should write event with ID when provided', () => {
      const mockRes = createMockResponse();
      const mockSubject = new Subject();
      mockSseService.subscribe.mockReturnValue(mockSubject.asObservable());

      controller.stream(mockUser, mockRes as Response, 'dm');

      (mockRes.write as jest.Mock).mockClear();

      mockSubject.next({
        event: 'dm.new_message',
        id: BigInt(999),
        data: { message: 'Hello' },
      });

      expect(mockRes.write).toHaveBeenCalledWith('event: dm.new_message\n');
      expect(mockRes.write).toHaveBeenCalledWith('id: 999\n');
      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ message: 'Hello' })}\n\n`,
      );

      cleanupConnection(mockRes);
      mockSubject.complete();
    });

    it('should write event without event name when not provided', () => {
      const mockRes = createMockResponse();
      const mockSubject = new Subject();
      mockSseService.subscribe.mockReturnValue(mockSubject.asObservable());

      controller.stream(mockUser, mockRes as Response, 'dm');

      (mockRes.write as jest.Mock).mockClear();

      mockSubject.next({
        data: { message: 'Hello' },
      });

      expect(mockRes.write).not.toHaveBeenCalledWith(expect.stringContaining('event:'));
      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ message: 'Hello' })}\n\n`,
      );

      cleanupConnection(mockRes);
      mockSubject.complete();
    });

    it('should clean up on connection close', () => {
      const mockRes = createMockResponse();
      const mockSubject = new Subject();
      const mockUnsubscribe = jest.fn();
      const mockObservable = mockSubject.asObservable();

      mockSseService.subscribe.mockReturnValue({
        ...mockObservable,
        subscribe: jest.fn(() => ({
          unsubscribe: mockUnsubscribe,
        })),
      });

      controller.stream(mockUser, mockRes as Response, 'dm');

      const mockResTyped = mockRes as Partial<Response> & { emit: (event: string) => boolean };
      mockResTyped.emit('close');

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockSseService.unsubscribe).toHaveBeenCalledWith('123');
    });

    it('should send session expired event after 2 hours', (done) => {
      jest.useFakeTimers();
      const mockRes = createMockResponse();
      const mockSubject = new Subject();
      mockSseService.subscribe.mockReturnValue(mockSubject.asObservable());

      controller.stream(mockUser, mockRes as Response, 'dm');

      (mockRes.write as jest.Mock).mockClear();

      jest.advanceTimersByTime(2 * 60 * 60 * 1000);

      expect(mockRes.write).toHaveBeenCalledWith(
        `event: session_expired\ndata: ${JSON.stringify({
          message: 'Connection expired after 2 hours. Please reconnect.',
        })}\n\n`,
      );
      expect(mockRes.end).toHaveBeenCalled();

      mockSubject.complete();
      done();
    });

    it('should send ping events every 25 seconds', (done) => {
      jest.useFakeTimers();
      const mockRes = createMockResponse();
      const mockSubject = new Subject();
      mockSseService.subscribe.mockReturnValue(mockSubject.asObservable());

      controller.stream(mockUser, mockRes as Response, 'dm');

      (mockRes.write as jest.Mock).mockClear();

      jest.advanceTimersByTime(25000);
      expect(mockRes.write).toHaveBeenCalledWith(': ping\n\n');

      (mockRes.write as jest.Mock).mockClear();

      jest.advanceTimersByTime(25000);
      expect(mockRes.write).toHaveBeenCalledWith(': ping\n\n');

      mockSubject.complete();
      done();
    });

    it('should clear timers on connection close', () => {
      jest.useFakeTimers();
      const mockRes = createMockResponse();
      const mockSubject = new Subject();
      mockSseService.subscribe.mockReturnValue(mockSubject.asObservable());

      controller.stream(mockUser, mockRes as Response, 'dm');

      (mockRes.write as jest.Mock).mockClear();

      mockRes.emit('close');

      jest.advanceTimersByTime(25000);
      expect(mockRes.write).not.toHaveBeenCalledWith(': ping\n\n');

      jest.advanceTimersByTime(2 * 60 * 60 * 1000);
      expect(mockRes.end).not.toHaveBeenCalled();

      mockSubject.complete();
    });
  });
});
