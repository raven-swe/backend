export class ConversationParticipantDto {
  username: string;
  displayName: string;
  avatarUrl: string;
}

export class LastMessageDto {
  content: string;
  senderUsername: string;
  sentAt: Date;
}

export class ConversationDto {
  id: string;

  participant: ConversationParticipantDto;

  lastMessage: LastMessageDto | null;

  isMuted: boolean;
  isBlocking: boolean;
  isBlockedBy: boolean;
}
