import { MediaType } from '@prisma/client';

// TODO: should be moved to mentions/ and hashtags/ modules
export class MentionDto {
  username: string;
  startPosition: number;
}

export class HashtagDto {
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
