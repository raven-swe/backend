import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum SearchTab {
  Top = 'top',
  Latest = 'latest',
  Media = 'media',
}

export class SearchTweetsQueryDto {
  @IsString()
  query: string;

  @IsEnum(SearchTab)
  @IsOptional()
  tab?: SearchTab;
}
