import { IsString } from 'class-validator';

export enum SearchTab {
  Top = 'top',
  Latest = 'latest',
  Media = 'media',
}

export class SearchTweetsQueryDto {
  @IsString()
  query: string;

  @IsString()
  tab?: SearchTab;

  @IsString()
  limit?: string;

  @IsString()
  cursor?: string;
}
