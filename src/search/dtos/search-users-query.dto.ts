import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PeopleSearchFilter } from './search-tweets-query.dto';

export class SearchUsersQueryDto {
  @IsString()
  query: string;

  @IsEnum(PeopleSearchFilter)
  @IsOptional()
  peopleFilter?: PeopleSearchFilter;

  @IsBoolean()
  @IsOptional()
  excludeMutedAndBlocked?: boolean;
}
