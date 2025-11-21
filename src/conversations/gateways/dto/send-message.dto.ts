import { IsNotEmpty, IsString, Length } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
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
}
