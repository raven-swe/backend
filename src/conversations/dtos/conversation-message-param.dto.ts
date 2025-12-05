import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ConversationIdParamDto } from './conversation-id-param.dto';

export class ConversationMessageParamDto extends ConversationIdParamDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, {
    message: 'message ID must be a valid numeric string',
  })
  messageId: string;
}
