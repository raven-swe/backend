export class ReactionUserDto {
  username: string;
  displayName: string;
  avatarUrl: string;
  reaction: string | null;
  reactedAt: Date | null;
}

export class MessageReactionsDto {
  sender: ReactionUserDto;
  receiver: ReactionUserDto;
}

export class MessageDto {
  id: string;
  content: string;
  createdAt: Date;
  isMine: boolean;
  mediaUrl: string | null;
  type: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  reactions: MessageReactionsDto;
}

export class ParticipantDto {
  username: string;
  displayName: string;
  avatarUrl: string;
  otherParticipantLastSeenMessageId: string;
}
