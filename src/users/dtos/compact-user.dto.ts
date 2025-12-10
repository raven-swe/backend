import { BioEntitiesDto } from './bio-entities.dto';

export class CompactUserDto {
  username: string;
  displayName: string;
  bio: string | null;
  bioEntities: BioEntitiesDto | null;
  avatarUrl: string | null;
}
