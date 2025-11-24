export class AuthorDto {
  username: string;
  displayName: string;
  avatarUrl: string | null | undefined;
  isBlocked: boolean;
  isFollowing: boolean;
  isMuted: boolean;
}
