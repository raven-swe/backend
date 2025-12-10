import { NotificationType } from '@prisma/client';
import { TweetDto } from 'src/tweets/dtos';
import { DeletedTweet } from 'src/tweets/types';
import { UserMetaDataDto } from 'src/users/dtos/user-meta-data.dto';

export class NotificationResponseDto {
  id: string;
  type: NotificationType;
  actorSummary: NotificationActorSummaryDto;
  tweetSummary: NotificationTweetSummaryDto;
  latestEventAt: Date;
  isSeen: boolean;
}

class NotificationActorSummaryDto {
  previewActors: UserMetaDataDto[];
  totalCount: number;
}

class NotificationTweetSummaryDto {
  primaryTweet: TweetDto | DeletedTweet | null;
  totalCount: number;
  subjectIds: string[];
}
