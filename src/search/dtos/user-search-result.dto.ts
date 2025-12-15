import { CompactUserDto } from 'src/users/dtos/compact-user.dto';
import { UserRelationshipDto } from 'src/users/dtos/relationship.dto';

export type UserSearchResultItem = CompactUserDto & {
  bannerUrl: string | null;
  relationship: UserRelationshipDto;
};

export class UserSearchResultDto {
  users: UserSearchResultItem[];
}
