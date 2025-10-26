import { IsString, IsNotEmpty } from 'class-validator';

export class CheckIdentifierQueryDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
