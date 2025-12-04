import { BioDto, UserRelationshipDto } from 'src/users/dtos';

export class UserInteractionDto extends BioDto {
  username: string;
  displayName: string;
  avatarUrl: string;
  relationship: UserRelationshipDto;
}
