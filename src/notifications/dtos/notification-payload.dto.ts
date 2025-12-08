export class NotificationPayloadDto {
  count: number;
  actors: Array<{
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    ifFollowing: boolean;
  }>;
  subjectIds?: Array<string>;
}
