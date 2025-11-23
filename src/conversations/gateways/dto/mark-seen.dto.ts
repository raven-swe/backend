import { IsNotEmpty, IsString } from 'class-validator';

export class MarkSeenDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsNotEmpty()
  @IsString()
  lastSeenMessageId: string;
}
