import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTweetDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  media?: string[];

  @IsOptional()
  @IsString()
  replyToTweetId?: string;

  @IsOptional()
  @IsString()
  quoteToTweetId?: string;
}
