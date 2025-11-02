import { IsString, IsNotEmpty } from 'class-validator';

export class ChangeLanguageDto {
  @IsString()
  @IsNotEmpty()
  language: string;
}
