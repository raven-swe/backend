import { BioEntitiesDto } from './bio-entities.dto';

export class UserRelationshipDto {
  blocking: boolean;
  blockedBy: boolean;
  following: boolean;
  follower: boolean;
  muted: boolean;
}

export class UserProfileResponseDto {
  username: string;
  displayName: string;
  bio: string | null;

  // Should be adjusted after implementing rich text bios
  bioEntities: BioEntitiesDto | null;

  avatarUrl: string | null | undefined;
  bannerUrl: string | null;
  location: string | null;
  websiteUrl: string | null;
  birthDate: string | null;

  // TODO: If I block the user, this will be null
  joinedAt: Date;

  // Won't be returned for the authenticated user's own profile
  relationship?: UserRelationshipDto | null;

  followingCount: number;
  followersCount: number;
  mutualsCount?: number | null;
  mutualNames?: string[] | null;

  email?: string;
}
