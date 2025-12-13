export class NotificationPayloadDto {
  count: number;
  actors: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string;
    ifFollowing: boolean;
  }>;
  subjectIds?: Array<string>;
}
