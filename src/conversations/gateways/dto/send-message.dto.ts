import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, {
    message: 'Conversation ID must be a valid numeric string',
  })
  conversationId: string;

  @IsNotEmpty()
  @IsString()
  clientMessageId: string;

  @IsNotEmpty()
  @IsString()
  @Length(1, 5000, {
    message: 'Message body must be between 1 and 5000 characters',
  })
  body: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, {
    message: 'Media ID must be a valid numeric string',
  })
  mediaId?: string;
}
