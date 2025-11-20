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

//TODO: should replace the above code with the below code but there is a small bug in the timeline controller that use the old code
//
// import { Transform } from 'class-transformer';
// import { IsOptional, IsString, IsInt } from 'class-validator';
// import { PAGINATION } from '../common/constants'; // Update path as needed
//
// export class PaginationQueryDto {
//   @IsOptional()
//   @IsString()
//   cursor?: string;
//
//   @IsOptional()
//   @IsInt()
//   @Transform(({ value }) => {
//     const parsed = parseInt(String(value), 10);
//
//     // 1. Ensure it's a valid positive number, otherwise use Default
//     const validNumber = !isNaN(parsed) && parsed > 0 ? parsed : PAGINATION.DEFAULT_LIMIT;
//
//     // 2. Clamp it to the Max Limit
//     return Math.min(validNumber, PAGINATION.MAX_LIMIT);
//   })
//   limit: number = PAGINATION.DEFAULT_LIMIT;
// }
