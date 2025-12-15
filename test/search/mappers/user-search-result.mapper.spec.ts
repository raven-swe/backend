import { JsonObject } from '@prisma/client/runtime/library';
import { mapToUserSearchResultDto } from 'src/search/mappers/user-search-result.mapper';
import { UserRelationshipDto } from 'src/users/dtos/relationship.dto';

describe('mapToUserSearchResultDto', () => {
  it('should map a single user item with all fields populated', () => {
    const bioEntities: JsonObject = {
      hashtags: [],
      mentions: [],
    };

    const relationship: UserRelationshipDto = {
      blocking: false,
      blockedBy: false,
      following: true,
      follower: true,
      muted: false,
    };

    const input = [
      {
        id: 'user-123',
        username: 'johndoe',
        displayName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        bannerUrl: 'https://example.com/banner.jpg',
        bio: 'Software developer',
        bioEntities: bioEntities,
        createdAt: new Date('2024-01-01'),
        rankingScore: BigInt(100),
        relationship,
      },
    ];

    const result = mapToUserSearchResultDto(input);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      username: 'johndoe',
      displayName: 'John Doe',
      bio: 'Software developer',
      bioEntities,
      avatarUrl: 'https://example.com/avatar.jpg',
      bannerUrl: 'https://example.com/banner.jpg',
      relationship,
    });
  });

  it('should handle null optional fields', () => {
    const input = [
      {
        id: 'user-456',
        username: 'janedoe',
        displayName: 'Jane Doe',
        avatarUrl: null,
        bannerUrl: null,
        bio: null,
        bioEntities: null,
        createdAt: new Date('2024-02-01'),
        rankingScore: BigInt(50),
      },
    ];

    const result = mapToUserSearchResultDto(input);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      username: 'janedoe',
      displayName: 'Jane Doe',
      bio: null,
      bioEntities: null,
      avatarUrl: null,
      bannerUrl: null,
      relationship: {
        blocking: false,
        blockedBy: false,
        following: false,
        follower: false,
        muted: false,
      },
    });
  });

  it('should provide default relationship when relationship is undefined', () => {
    const input = [
      {
        id: 'user-789',
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        bannerUrl: null,
        bio: 'Test bio',
        bioEntities: null,
        createdAt: new Date('2024-03-01'),
        rankingScore: BigInt(75),
        relationship: undefined,
      },
    ];

    const result = mapToUserSearchResultDto(input);

    expect(result[0].relationship).toEqual({
      blocking: false,
      blockedBy: false,
      following: false,
      follower: false,
      muted: false,
    });
  });

  it('should handle empty array', () => {
    const result = mapToUserSearchResultDto([]);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should map multiple user items correctly', () => {
    const input = [
      {
        id: 'user-1',
        username: 'user1',
        displayName: 'User One',
        avatarUrl: 'https://example.com/avatar1.jpg',
        bannerUrl: null,
        bio: 'First user',
        bioEntities: null,
        createdAt: new Date('2024-01-01'),
        rankingScore: BigInt(100),
        relationship: {
          blocking: false,
          blockedBy: false,
          following: true,
          follower: false,
          muted: false,
        },
      },
      {
        id: 'user-2',
        username: 'user2',
        displayName: 'User Two',
        avatarUrl: null,
        bannerUrl: 'https://example.com/banner2.jpg',
        bio: 'Second user',
        bioEntities: null,
        createdAt: new Date('2024-02-01'),
        rankingScore: BigInt(90),
        relationship: null,
      },
      {
        id: 'user-3',
        username: 'user3',
        displayName: 'User Three',
        avatarUrl: 'https://example.com/avatar3.jpg',
        bannerUrl: 'https://example.com/banner3.jpg',
        bio: null,
        bioEntities: null,
        createdAt: new Date('2024-03-01'),
        rankingScore: BigInt(80),
      },
    ];

    const result = mapToUserSearchResultDto(input);

    expect(result).toHaveLength(3);
    expect(result[0].username).toBe('user1');
    expect(result[0].relationship?.following).toBe(true);
    expect(result[1].username).toBe('user2');
    expect(result[1].relationship).toEqual({
      blocking: false,
      blockedBy: false,
      following: false,
      follower: false,
      muted: false,
    });
    expect(result[2].username).toBe('user3');
    expect(result[2].avatarUrl).toBe('https://example.com/avatar3.jpg');
  });
});
