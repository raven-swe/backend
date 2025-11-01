export class BioEntitiesDto {
  mentions: MentionDto[];
  hashtags: HashtagDto[];
}

class MentionDto {
  username: string;
  startPosition: number;
}

class HashtagDto {
  hashtag: string;
  startPosition: number;
}
