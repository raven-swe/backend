import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum SearchTab {
  Top = 'top',
  Latest = 'latest',
  Media = 'media',
}

export enum PeopleSearchFilter {
  Following = 'following',
  Anyone = 'anyone',
}

export class SearchTweetsQueryDto {
  @IsString()
  query: string;

  @IsEnum(SearchTab)
  @IsOptional()
  tab?: SearchTab;

  @IsEnum(PeopleSearchFilter)
  @IsOptional()
  peopleFilter?: PeopleSearchFilter;

  @IsBoolean()
  @IsOptional()
  excludeMutedAndBlocked?: boolean;
}
