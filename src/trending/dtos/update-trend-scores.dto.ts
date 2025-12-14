import { IsArray, IsNumber, IsString, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class ModelTopicDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsNumber()
  trend_score: number;

  @IsNumber()
  occurence_in_category: number;
}

class ModelItemDto {
  @IsString()
  @IsNotEmpty()
  keyword: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModelTopicDto)
  top_related_topics: ModelTopicDto[];
}

class BatchMetaDto {
  @IsNumber()
  total_tweets: number;
}

export class UpdateTrendScoresDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModelItemDto)
  trending_keywords: ModelItemDto[];

  @ValidateNested()
  @Type(() => BatchMetaDto)
  batch_meta: BatchMetaDto;
}
