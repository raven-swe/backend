import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsInt } from 'class-validator';
import { PAGINATION } from '../constants';

export class PaginationQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => {
    const parsed = parseInt(String(value), 10);

    // 1. Ensure it's a valid positive number, otherwise use Default
    const validNumber = !isNaN(parsed) && parsed > 0 ? parsed : PAGINATION.DEFAULT_LIMIT;

    // 2. Clamp it to the Max Limit
    return Math.min(validNumber, PAGINATION.MAX_LIMIT);
  })
  limit: number = PAGINATION.DEFAULT_LIMIT;
}
