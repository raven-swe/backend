import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { PAGINATION_DEFAULT_LIMIT } from '../constants/generic.constants';

export class PaginationQueryDto {
  @IsOptional()
  @IsString()
  cursor: string;

  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => parseInt(String(value), 10) || PAGINATION_DEFAULT_LIMIT,
  )
  limit: number;
}
