import { HashtagDto, MentionDto } from 'src/tweets/dtos';

export class BioEntitiesDto {
  mentions: MentionDto[];
  hashtags: HashtagDto[];
}

export class BioDto {
  text: string;
  bioEntities: BioEntitiesDto;
}
