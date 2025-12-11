export class AuthorDto {
  username: string;
  displayName: string;
  avatarUrl: string | null | undefined;
  relationship: relationship;
}

type relationship = {
  blocking?: boolean;
  blockedBy?: boolean;
  muted?: boolean;
  following?: boolean;
  follower?: boolean;
};
