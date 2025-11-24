import { IsString, IsNotEmpty } from 'class-validator';

export class SearchUsernameQueryDto {
  @IsString()
  @IsNotEmpty()
  query: string;
}
