import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class MarkSeenDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, {
    message: 'Conversation ID must be a valid numeric string',
  })
  conversationId: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+$/, {
    message: 'Last seen message ID must be a valid numeric string',
  })
  lastSeenMessageId: string;
}
