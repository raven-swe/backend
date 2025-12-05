import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class TypingIndicatorDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, {
    message: 'Conversation ID must be a valid numeric string',
  })
  conversationId: string;
}
