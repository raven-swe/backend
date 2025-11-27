import { UserRelationshipDto } from 'src/users/dtos';

export class AuthorDto {
  username: string;
  displayName: string;
  avatarUrl: string | null | undefined;
  relationship: UserRelationshipDto;
}
