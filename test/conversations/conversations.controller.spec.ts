/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from 'src/conversations/conversations.controller';
import { ConversationsService } from 'src/conversations/conversations.service';
import { JwtAuthGuard } from 'src/auth/guards';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let service: jest.Mocked<ConversationsService>;

  const mockUser = {
    id: '6',
    username: 'layla',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        {
          provide: ConversationsService,
          useValue: {
            getUserConversations: jest.fn(),
            createOrFindConversation: jest.fn(),
            countUnseenConversations: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ConversationsController>(ConversationsController);
    service = module.get(ConversationsService);

    jest.clearAllMocks();
  });

  describe('getUserConversations', () => {
    it('should successfully retrieve user conversations', async () => {
      const mockResult = {
        items: [
          {
            id: '1',
            participant: {
              username: 'tasneem',
              displayName: 'Tasneem',
              avatarUrl: 'https://example.com/avatar.jpg',
            },
            lastMessage: null,
            isMuted: false,
            isBlocking: false,
            isBlockedBy: false,
          },
        ],
        pagination: { hasNextPage: false, nextCursor: null },
      };
      service.getUserConversations.mockResolvedValue(mockResult);

      const result = await controller.getUserConversations(mockUser, {
        limit: 10,
        cursor: '',
      });

      expect(service.getUserConversations).toHaveBeenCalledWith(BigInt(6), 10, '');
      expect(result).toEqual(mockResult);
    });

    it('should pass pagination cursor to service', async () => {
      const mockResult = { items: [], pagination: { hasNextPage: false, nextCursor: null } };
      service.getUserConversations.mockResolvedValue(mockResult);

      const cursor = 'eyJjb252ZXJzYXRpb25JZCI6IjUifQ==';
      await controller.getUserConversations(mockUser, { limit: 20, cursor });

      expect(service.getUserConversations).toHaveBeenCalledWith(BigInt(6), 20, cursor);
    });

    it('should handle empty conversations list', async () => {
      const mockResult = { items: [], pagination: { hasNextPage: false, nextCursor: null } };
      service.getUserConversations.mockResolvedValue(mockResult);

      const result = await controller.getUserConversations(mockUser, {
        limit: 10,
        cursor: '',
      });

      expect(result.items).toEqual([]);
    });

    it('should convert user id to BigInt correctly', async () => {
      const mockResult = { items: [], pagination: { hasNextPage: false, nextCursor: null } };
      service.getUserConversations.mockResolvedValue(mockResult);

      await controller.getUserConversations(mockUser, { limit: 10, cursor: '' });

      expect(service.getUserConversations).toHaveBeenCalledWith(expect.any(BigInt), 10, '');
    });
  });

  describe('createOrFindConversation', () => {
    it('should successfully create or find conversation with username', async () => {
      const mockConversation = {
        id: '1',
        participant: {
          username: 'tasneem',
          displayName: 'Tasneem',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
        lastMessage: null,
        isMuted: false,
        isBlocking: false,
        isBlockedBy: false,
      };
      service.createOrFindConversation.mockResolvedValue(mockConversation);

      const result = await controller.createOrFindConversation(mockUser, { username: 'tasneem' });

      expect(service.createOrFindConversation).toHaveBeenCalledWith(BigInt(6), 'tasneem');
      expect(result).toEqual(mockConversation);
    });

    it('should return existing conversation if already exists', async () => {
      const mockConversation = {
        id: '5',
        participant: {
          username: 'kimo',
          displayName: 'Kimo',
          avatarUrl: 'https://example.com/kimo.jpg',
        },
        lastMessage: { content: 'Hi', senderUsername: 'kimo', sentAt: new Date() },
        isMuted: false,
        isBlocking: false,
        isBlockedBy: false,
      };
      service.createOrFindConversation.mockResolvedValue(mockConversation);

      const result = await controller.createOrFindConversation(mockUser, { username: 'kimo' });

      expect(result).toEqual(mockConversation);
    });

    it('should handle conversation creation errors gracefully', async () => {
      service.createOrFindConversation.mockRejectedValue(new Error('User not found'));

      await expect(
        controller.createOrFindConversation(mockUser, { username: 'nonexistent' }),
      ).rejects.toThrow('User not found');
    });

    it('should pass correct user and username parameters', async () => {
      const mockConversation = {
        id: '1',
        participant: {
          username: 'someuser',
          displayName: 'Some User',
          avatarUrl: 'https://example.com/user.jpg',
        },
        lastMessage: null,
        isMuted: false,
        isBlocking: false,
        isBlockedBy: false,
      };
      service.createOrFindConversation.mockResolvedValue(mockConversation);

      await controller.createOrFindConversation(mockUser, { username: 'someuser' });

      expect(service.createOrFindConversation).toHaveBeenCalledWith(BigInt(6), 'someuser');
    });
  });

  describe('getUnseenConversationsCount', () => {
    it('should successfully retrieve unseen conversations count', async () => {
      service.countUnseenConversations.mockResolvedValue(3);

      const result = await controller.getUnseenConversationsCount(mockUser);

      expect(service.countUnseenConversations).toHaveBeenCalledWith(BigInt(6));
      expect(result).toEqual({ count: 3 });
    });

    it('should return zero when no unseen conversations', async () => {
      service.countUnseenConversations.mockResolvedValue(0);

      const result = await controller.getUnseenConversationsCount(mockUser);

      expect(result).toEqual({ count: 0 });
    });

    it('should return count for user with multiple unseen conversations', async () => {
      service.countUnseenConversations.mockResolvedValue(15);

      const result = await controller.getUnseenConversationsCount(mockUser);

      expect(result).toEqual({ count: 15 });
    });

    it('should convert user id to BigInt', async () => {
      service.countUnseenConversations.mockResolvedValue(5);

      await controller.getUnseenConversationsCount(mockUser);

      expect(service.countUnseenConversations).toHaveBeenCalledWith(expect.any(BigInt));
    });
  });
});
