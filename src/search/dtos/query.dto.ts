import { IsString } from 'class-validator';

export class QueryDto {
  @IsString()
  query: string;
}
