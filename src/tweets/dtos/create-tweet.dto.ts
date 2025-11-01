import { IsEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTweetDto {
  @IsEmpty()
  @IsString()
  content: string;

  // TODO media field will be added later

  @IsOptional()
  @IsString()
  replyToTweetId?: string;

  @IsOptional()
  @IsString()
  quoteToTweetId?: string;
}
