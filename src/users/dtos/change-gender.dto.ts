import { IsString, IsNotEmpty } from 'class-validator';

export class ChangeGenderDto {
  @IsString()
  @IsNotEmpty()
  gender: string;
}
