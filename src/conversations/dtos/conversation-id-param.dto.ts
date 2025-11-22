import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class ConversationIdParamDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, {
    message: 'Conversation ID must be a valid numeric string',
  })
  conversationId: string;
}
