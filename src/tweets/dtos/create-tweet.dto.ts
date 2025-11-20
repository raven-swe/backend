import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTweetDto {
  @IsNotEmpty()
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
