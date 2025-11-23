import { IsNotEmpty } from 'class-validator';

import { IsMinYearsOld } from '../../auth/validators/is-min-years-old';
import { IsoDate } from 'src/common/utils';

export class UpdateBirthDateDto {
  @IsoDate()
  @IsNotEmpty()
  @IsMinYearsOld(13, {
    message: 'You must be at least 13 years old to register',
  })
  date: Date;
}
