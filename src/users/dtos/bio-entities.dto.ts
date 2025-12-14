import { HashtagDto, MentionDto } from 'src/tweets/dtos';

export class BioEntitiesDto {
  mentions: MentionDto[] | null;
  hashtags: HashtagDto[] | null;
}

export class BioDto {
  bio: string;
  bioEntities: BioEntitiesDto;
}
