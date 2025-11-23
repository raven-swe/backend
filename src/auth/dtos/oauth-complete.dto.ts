import {
  IsString,
  IsNotEmpty,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { IsoDate } from 'src/common/utils';
import { IsMinYearsOld } from '../validators';

export class OauthCompleteDto {
  @IsNotEmpty()
  @IsString()
  creationToken: string;
  @IsoDate()
  @IsNotEmpty()
  @IsMinYearsOld(13)
  birthDate: Date;
}
