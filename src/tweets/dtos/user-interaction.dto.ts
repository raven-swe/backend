import { BioDto, UserRelationshipDto } from 'src/users/dtos';

export class UserInteractionDto {
  username: string;
  displayName: string;
  avatarUrl: string;
  relationship: UserRelationshipDto;
  bio: BioDto | null;
}
