export class MessageDto {
  id: string;
  content: string;
  createdAt: Date;
  isMine: boolean;
}

export class ParticipantDto {
  username: string;
  displayName: string;
  avatarUrl: string;
  otherParticipantLastSeenMessageId: string;
}
