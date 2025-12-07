/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConversationsService } from '../../src/conversations/conversations.service';
import { ConversationsRepository } from '../../src/conversations/conversations.repository';
import { UsersRepository } from 'src/users/users.repository';
import { VALIDATION_ERROR_CODES } from 'src/common/constants';
import { USERS_ERROR_MESSAGES } from 'src/users/constants';
import { CONVERSATIONS_ERROR_CODES } from '../../src/conversations/constants/conversation-constants';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let conversationsRepository: jest.Mocked<ConversationsRepository>;
  let usersRepository: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const mockConversationsRepository = {
      getUserConversations: jest.fn(),
      findConversation: jest.fn(),
      createConversation: jest.fn(),
      assertParticipant: jest.fn(),
      getConversationParticipants: jest.fn(),
      countUnseenConversations: jest.fn(),
    };

    const mockUsersRepository = {
      getUserByUsername: jest.fn(),
      getBlockingBlockedState: jest.fn(),
      getUserBlockRelations: jest.fn(),
      isBlocked: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: ConversationsRepository,
          useValue: mockConversationsRepository,
        },
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    conversationsRepository = module.get(ConversationsRepository);
    usersRepository = module.get(UsersRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserConversations', () => {
    const userId = BigInt(1);
    const limit = 10;

    it('should return paginated conversations with block status', async () => {
      const mockConversations = [
        {
          id: BigInt(1),
          creatorId: userId,
          lastMessageId: BigInt(1),
          conversationParticipants: [
            {
              userId,
              lastSeenMessageId: null,
              notificationsMuted: false,
              user: {
                username: 'user1',
                profile: { displayName: 'User One', avatarUrl: 'avatar1.jpg' },
              },
            },
            {
              userId: BigInt(2),
              lastSeenMessageId: null,
              notificationsMuted: false,
              user: {
                username: 'user2',
                profile: { displayName: 'User Two', avatarUrl: 'avatar2.jpg' },
              },
            },
          ],
          messages: [
            {
              content: 'Hello',
              user: { username: 'user2' },
              createdAt: new Date(),
            },
          ],
          lastMessage: {
            content: 'Hello',
            user: { username: 'user2' },
            createdAt: new Date(),
          },
        },
      ];

      conversationsRepository.getUserConversations.mockResolvedValue(mockConversations);
      usersRepository.getUserBlockRelations.mockResolvedValueOnce([]);
      const result = await service.getUserConversations(userId, limit, '');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('1');
      expect(result.items[0].participant.username).toBe('user2');
      expect(result.items[0].isBlocking).toBe(false);
      expect(result.items[0].isBlockedBy).toBe(false);
      expect(conversationsRepository.getUserConversations).toHaveBeenCalledWith(
        userId,
        limit + 1,
        undefined,
      );
    });

    it('should throw error for invalid cursor format', async () => {
      const invalidCursor = 'invalid-cursor';

      await expect(service.getUserConversations(userId, limit, invalidCursor)).rejects.toThrow(
        HttpException,
      );

      try {
        await service.getUserConversations(userId, limit, invalidCursor);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = (error as HttpException).getResponse() as {
          message: string;
          code: string;
        };
        expect(response.code).toBe(VALIDATION_ERROR_CODES.INVALID_FORMAT);
      }
    });

    it('should throw error for cursor missing conversationId', async () => {
      const cursorWithoutConvId = Buffer.from(
        JSON.stringify({ lastMessageCreatedAt: '2024-01-01T00:00:00.000Z' }),
      ).toString('base64');

      await expect(
        service.getUserConversations(userId, limit, cursorWithoutConvId),
      ).rejects.toThrow(HttpException);

      try {
        await service.getUserConversations(userId, limit, cursorWithoutConvId);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = (error as HttpException).getResponse() as {
          message: string;
          code: string;
        };
        expect(response.code).toBe(VALIDATION_ERROR_CODES.INVALID_FORMAT);
      }
    });

    it('should throw error for cursor missing lastMessageCreatedAt', async () => {
      const cursorWithoutDate = Buffer.from(JSON.stringify({ conversationId: '123' })).toString(
        'base64',
      );

      await expect(service.getUserConversations(userId, limit, cursorWithoutDate)).rejects.toThrow(
        HttpException,
      );

      try {
        await service.getUserConversations(userId, limit, cursorWithoutDate);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = (error as HttpException).getResponse() as {
          message: string;
          code: string;
        };
        expect(response.code).toBe(VALIDATION_ERROR_CODES.INVALID_FORMAT);
      }
    });

    it('should throw error for cursor with empty lastMessageCreatedAt', async () => {
      const cursorWithEmptyDate = Buffer.from(
        JSON.stringify({ conversationId: '123', lastMessageCreatedAt: '   ' }),
      ).toString('base64');

      await expect(
        service.getUserConversations(userId, limit, cursorWithEmptyDate),
      ).rejects.toThrow(HttpException);

      try {
        await service.getUserConversations(userId, limit, cursorWithEmptyDate);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = (error as HttpException).getResponse() as {
          message: string;
          code: string;
        };
        expect(response.code).toBe(VALIDATION_ERROR_CODES.INVALID_FORMAT);
      }
    });

    it('should throw error for cursor with invalid date format', async () => {
      const cursorWithInvalidDate = Buffer.from(
        JSON.stringify({ conversationId: '123', lastMessageCreatedAt: 'not-a-date' }),
      ).toString('base64');

      await expect(
        service.getUserConversations(userId, limit, cursorWithInvalidDate),
      ).rejects.toThrow(HttpException);

      try {
        await service.getUserConversations(userId, limit, cursorWithInvalidDate);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = (error as HttpException).getResponse() as {
          message: string;
          code: string;
        };
        expect(response.code).toBe(VALIDATION_ERROR_CODES.INVALID_FORMAT);
      }
    });

    it('should filter out conversations with blocked users', async () => {
      const mockConversations = [
        {
          id: BigInt(1),
          creatorId: userId,
          lastMessageId: BigInt(1),
          conversationParticipants: [
            {
              userId,
              lastSeenMessageId: null,
              notificationsMuted: false,
              user: {
                username: 'user1',
                profile: { displayName: 'User One', avatarUrl: 'avatar1.jpg' },
              },
            },
            {
              userId: BigInt(2),
              lastSeenMessageId: null,
              notificationsMuted: false,
              user: {
                username: 'blocked_user',
                profile: { displayName: 'Blocked User', avatarUrl: 'avatar2.jpg' },
              },
            },
          ],
          messages: [
            {
              content: 'Hello',
              user: { username: 'blocked_user' },
              createdAt: new Date(),
            },
          ],
          lastMessage: {
            content: 'Hello',
            user: { username: 'blocked_user' },
            createdAt: new Date(),
          },
        },
      ];

      conversationsRepository.getUserConversations.mockResolvedValue(mockConversations);
      usersRepository.getUserBlockRelations.mockResolvedValueOnce([
        {
          userId,
          blockedId: BigInt(2),
        },
      ]);

      const result = await service.getUserConversations(userId, limit, '');

      expect(result.items[0].isBlocking).toBe(true);
      expect(result.items[0].isBlockedBy).toBe(false);
    });
  });

  describe('createOrFindConversation', () => {
    const userId = BigInt(1);
    const username = 'testuser';
    const otherUser = {
      id: BigInt(2),
      username: 'testuser',
      profile: { displayName: 'Test User', avatarUrl: 'test.jpg' },
    };

    it('should return existing conversation', async () => {
      const mockConversation = {
        id: BigInt(1),
        creatorId: userId,
        lastMessageId: null,
        conversationParticipants: [
          {
            userId,
            lastSeenMessageId: null,
            notificationsMuted: false,
            user: {
              username: 'user1',
              profile: { displayName: 'User One', avatarUrl: 'avatar1.jpg' },
            },
          },
          {
            userId: otherUser.id,
            lastSeenMessageId: null,
            notificationsMuted: false,
            user: otherUser,
          },
        ],
        messages: [],
        lastMessage: { content: 'Hello', user: { username: 'testuser' }, createdAt: new Date() },
      };

      usersRepository.getUserByUsername.mockResolvedValue(otherUser);
      conversationsRepository.findConversation.mockResolvedValue(mockConversation);
      usersRepository.isBlocked.mockResolvedValue(false);

      const result = await service.createOrFindConversation(userId, username);

      expect(result.id).toBe('1');
      expect(result.participant.username).toBe('testuser');
      expect(conversationsRepository.createConversation).not.toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      usersRepository.getUserByUsername.mockResolvedValue(null);

      await expect(service.createOrFindConversation(userId, username)).rejects.toThrow(
        HttpException,
      );

      try {
        await service.createOrFindConversation(userId, username);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
        const response = (error as HttpException).getResponse() as {
          message: string;
          code: string;
        };
        expect(response.message).toBe(USERS_ERROR_MESSAGES.USER_NOT_FOUND);
      }
    });

    it('should create new conversation if none exists', async () => {
      const mockConversation = {
        id: BigInt(1),
        creatorId: userId,
        lastMessageId: null,
        conversationParticipants: [
          {
            userId,
            lastSeenMessageId: null,
            notificationsMuted: false,
            user: {
              username: 'user1',
              profile: { displayName: 'User One', avatarUrl: 'avatar1.jpg' },
            },
          },
          {
            userId: otherUser.id,
            lastSeenMessageId: null,
            notificationsMuted: false,
            user: otherUser,
          },
        ],
        messages: [],
        lastMessage: null,
      };

      usersRepository.getUserByUsername.mockResolvedValue(otherUser);
      conversationsRepository.findConversation.mockResolvedValueOnce(null);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      conversationsRepository.findConversation.mockResolvedValueOnce(mockConversation as any);
      conversationsRepository.createConversation.mockResolvedValue({
        id: BigInt(1),
        creatorId: userId,
        lastMessageId: null,
        createdAt: new Date(),
      });

      const result = await service.createOrFindConversation(userId, username);

      expect(conversationsRepository.createConversation).toHaveBeenCalledWith(userId, otherUser.id);
      expect(result.id).toBe('1');
    });

    it('should throw error if user is blocking target', async () => {
      usersRepository.getUserByUsername.mockResolvedValue(otherUser);
      conversationsRepository.findConversation.mockResolvedValue(null);
      usersRepository.isBlocked.mockResolvedValue(true);

      await expect(service.createOrFindConversation(userId, username)).rejects.toThrow(
        HttpException,
      );

      try {
        await service.createOrFindConversation(userId, username);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = (error as HttpException).getResponse() as {
          message: string;
          code: string;
        };
        expect(response.code).toBe(CONVERSATIONS_ERROR_CODES.BLOCKED_USER);
      }
    });

    it('should throw error if user is blocked by target', async () => {
      usersRepository.getUserByUsername.mockResolvedValue(otherUser);
      conversationsRepository.findConversation.mockResolvedValue(null);
      usersRepository.isBlocked.mockResolvedValue(true);

      await expect(service.createOrFindConversation(userId, username)).rejects.toThrow(
        HttpException,
      );

      try {
        await service.createOrFindConversation(userId, username);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should throw error if conversation creation fails', async () => {
      usersRepository.getUserByUsername.mockResolvedValue(otherUser);
      conversationsRepository.findConversation.mockResolvedValue(null);
      conversationsRepository.createConversation.mockResolvedValue({
        id: BigInt(1),
        creatorId: userId,
        lastMessageId: null,
        createdAt: new Date(),
      });
      usersRepository.isBlocked.mockResolvedValue(false);

      await expect(service.createOrFindConversation(userId, username)).rejects.toThrow(
        HttpException,
      );

      try {
        await service.createOrFindConversation(userId, username);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        const response = (error as HttpException).getResponse() as {
          message: string;
          code: string;
        };
        expect(response.code).toBe(CONVERSATIONS_ERROR_CODES.CONVERSATION_CREATION_FAILED);
      }
    });
  });

  describe('assertParticipant', () => {
    it('should return true for valid participant', async () => {
      const userId = '1';
      const conversationId = '2';
      const mockParticipants = [
        {
          user: {
            id: BigInt(1),
            username: 'user1',
            profile: { displayName: 'User One', avatarUrl: 'avatar1.jpg' },
          },
        },
        {
          user: {
            id: BigInt(2),
            username: 'user2',
            profile: { displayName: 'User Two', avatarUrl: 'avatar2.jpg' },
          },
        },
      ];

      conversationsRepository.getConversationParticipants.mockResolvedValue(mockParticipants);
      usersRepository.getBlockingBlockedState.mockResolvedValue(false);
      conversationsRepository.assertParticipant.mockResolvedValue(true);

      const result = await service.assertParticipant(userId, conversationId);

      expect(result).toBe(true);
      expect(conversationsRepository.assertParticipant).toHaveBeenCalledWith(BigInt(1), BigInt(2));
    });

    it('should return null for invalid userId', async () => {
      const result = await service.assertParticipant('invalid', '2');

      expect(result).toBeNull();
      expect(conversationsRepository.assertParticipant).not.toHaveBeenCalled();
    });

    it('should return null for invalid conversationId', async () => {
      const result = await service.assertParticipant('1', 'invalid');

      expect(result).toBeNull();
      expect(conversationsRepository.assertParticipant).not.toHaveBeenCalled();
    });
  });

  describe('getConversationParticipants', () => {
    it('should return participants for valid conversation ID', async () => {
      const conversationId = '1';
      const mockParticipants = [
        {
          user: {
            id: BigInt(1),
            username: 'user1',
            profile: { displayName: 'User One', avatarUrl: 'avatar1.jpg' },
          },
        },
        {
          user: {
            id: BigInt(2),
            username: 'user2',
            profile: { displayName: 'User Two', avatarUrl: 'avatar2.jpg' },
          },
        },
      ];

      conversationsRepository.getConversationParticipants.mockResolvedValue(mockParticipants);

      const result = await service.getConversationParticipants(conversationId);

      expect(result).toBe(mockParticipants);
      expect(conversationsRepository.getConversationParticipants).toHaveBeenCalledWith(BigInt(1));
    });

    it('should return null for invalid conversation ID', async () => {
      const result = await service.getConversationParticipants('invalid');

      expect(result).toBeNull();
      expect(conversationsRepository.getConversationParticipants).not.toHaveBeenCalled();
    });
  });

  describe('countUnseenConversations', () => {
    it('should return count of unseen conversations', async () => {
      const userId = BigInt(1);
      const mockCount = 5;

      conversationsRepository.countUnseenConversations.mockResolvedValue(mockCount);

      const result = await service.countUnseenConversations(userId);

      expect(result).toBe(mockCount);
      expect(conversationsRepository.countUnseenConversations).toHaveBeenCalledWith(userId);
    });
  });
});
