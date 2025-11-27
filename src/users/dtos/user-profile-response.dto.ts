import { CompactUserDto } from './compact-user.dto';

export class UserProfileResponseDto {
  username: string;
  displayName: string;
  bio: string | null;

  // Should be adjusted after implementing rich text bios
  bioEntities: BioEntitiesDto | null;

  avatarUrl: string | null | undefined;
export class UserProfileResponseDto extends CompactUserDto {
  bannerUrl: string | null;
  location: string | null;
  websiteUrl: string | null;
  birthDate: string | null;

  // TODO: If I block the user, this will be null
  joinedAt: Date;

  followingCount: number;
  followersCount: number;
  mutualsCount?: number | null;
  mutualUsers?: MutualUserDto[] | null;

  phone?: string;
  languageCode?: string;
  email?: string;
}

export class MutualUserDto {
  displayName: string;
  avatarUrl: string | null | undefined;
}
