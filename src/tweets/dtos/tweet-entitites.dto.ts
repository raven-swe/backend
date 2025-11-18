import { MediaType } from '@prisma/client';

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

export class MediaEntityDto {
  type: MediaType;
  url: string;
  altText: string | null;
  width: number;
  height: number;
}
