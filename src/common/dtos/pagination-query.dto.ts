import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { PAGINATION_DEFAULT_LIMIT } from '../constants/generic.constants';

export class PaginationQueryDto {
  @IsOptional()
  @IsString()
  cursor: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return PAGINATION_DEFAULT_LIMIT;
    }
    const parsed = parseInt(value as string, 10);
    return isNaN(parsed) ? PAGINATION_DEFAULT_LIMIT : parsed;
  })
  limit: number = PAGINATION_DEFAULT_LIMIT;
}
