import { UserRelationshipDto } from 'src/users/dtos/relationship.dto';

export class AuthorDto {
  username: string;
  displayName: string;
  avatarUrl: string | null | undefined;
  relationship: UserRelationshipDto | null;
}
