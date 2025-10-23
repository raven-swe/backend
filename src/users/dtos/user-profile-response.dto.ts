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
  bioEntities: null;

  avatarUrl: string | null;
  bannerUrl: string | null;
  location: string | null;
  websiteUrl: string | null;
  birthDate: Date | null;
  joinedAt: Date;

  // Won't be returned for the authenticated user's own profile
  relationship?: UserRelationshipDto;

  // BigInt as string since we can't return BigInt directly in DTO
  followingCount: string;
  followersCount: string;
  mutualsCount?: number | null;
  mutualNames: string[] | null;
}
