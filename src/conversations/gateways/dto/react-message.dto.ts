import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import emojiRegex from 'emoji-regex';

const emojiPattern = (emojiRegex as unknown as () => RegExp)().source;

export class ReactionDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, {
    message: 'Conversation ID must be a valid numeric string',
  })
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, {
    message: 'Message ID must be a valid numeric string',
  })
  messageId: string;

  @IsString()
  @Length(1, 16)
  @Matches(new RegExp(`^(${emojiPattern})+$`), {
    message: 'Reaction must be a valid emoji',
  })
  reaction: string;
}
