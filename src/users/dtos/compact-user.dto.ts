import { BioEntitiesDto } from './bio-entities.dto';

export class CompactUserDto {
  username: string;
  displayName: string;
  bio: string;
  bioEntities: BioEntitiesDto;
  avatarUrl: string;
}
