import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateTweetDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  media?: string[];

  @IsOptional()
  @IsString()
  replyToTweetId?: string;

  @IsOptional()
  @IsString()
  quoteToTweetId?: string;
}
