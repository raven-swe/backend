import { IsString, IsNotEmpty } from 'class-validator';

export class ResendOtpDto {
  @IsString({ message: 'Creation token must be a string' })
  @IsNotEmpty()
  creationToken: string;
}
