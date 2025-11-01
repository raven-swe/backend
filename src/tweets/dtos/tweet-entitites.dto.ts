class MentionDto {
  username: string;
  startPosition: number;
}

class HashtagDto {
  hashtag: string;
  startPosition: number;
}

export class TweetEntitiesDto {
  mentions: MentionDto[];
  hashtags: HashtagDto[];
}
