import { UserRelationshipDto } from 'src/users/dtos';
import { CompactUserDto } from 'src/users/dtos/compact-user.dto';

export type UserSearchResultItem = CompactUserDto & {
  bannerUrl: string;
  relationship: UserRelationshipDto;
};

export class UserSearchResultDto {
  users: UserSearchResultItem[];
}
