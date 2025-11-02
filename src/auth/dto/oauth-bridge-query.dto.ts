import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class OAuthBridgeQueryDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  error?: string;

  @IsString()
  @IsOptional()
  errorDescription?: string;

  @IsString()
  @IsNotEmpty()
  state: string;
}
