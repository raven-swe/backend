export class NotificationPayloadDto {
  actorsPreview: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string;
    ifFollowing: boolean;
  }>;
  actorsIds?: Array<string>;
}
