import { IsString, IsNotEmpty } from 'class-validator';

export class ChangeCountryDto {
  @IsString()
  @IsNotEmpty()
  countryName: string;
}
