import { IsDate, IsNotEmpty } from 'class-validator';

import { IsMinYearsOld } from '../../auth/validators/is-min-years-old';

export class UpdateBirthDateDto {
  @IsNotEmpty()
  @IsDate()
  @IsMinYearsOld(13, {
    message: 'You must be at least 13 years old',
  })
  date: Date;
}
