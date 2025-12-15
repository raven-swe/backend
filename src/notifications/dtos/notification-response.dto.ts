import { NotificationType } from '@prisma/client';
import { TweetDto } from 'src/tweets/dtos';
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
  primaryTweet: TweetDto | null;
  totalCount: number;
}
