import { AuthorDto } from 'src/tweets/dtos';
import { BioEntitiesDto } from './bio-entities.dto';

export class CompactUserDto extends AuthorDto {
  bio: string | null;
  bioEntities: BioEntitiesDto | null;
}
