import { JsonArray, JsonObject } from '@prisma/client/runtime/binary';
import { BioEntitiesDto, UserRelationshipDto } from 'src/users/dtos';
import { UserSearchResultItem } from '../dtos/user-search-result.dto';

export function mapToUserSearchResultDto(
  items: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    bioEntities: string | number | true | JsonObject | JsonArray | null;
    createdAt: Date;
    simScore: number;
    relationship?: UserRelationshipDto | null;
  }[],
): UserSearchResultItem[] {
  return items.map((item) => ({
    username: item.username,
    displayName: item.displayName,
    bio: item.bio,
    bioEntities: (item.bioEntities as unknown as BioEntitiesDto) || null,
    avatarUrl: item.avatarUrl,
    bannerUrl: item.bannerUrl,
    relationship: item.relationship || {
      blocking: false,
      blockedBy: false,
      following: false,
      follower: false,
      muted: false,
    },
  }));
}
