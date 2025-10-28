import { HttpException, HttpStatus } from '@nestjs/common';
import { ChangePasswordBasicDto } from '../dtos/change-password-basic.dto';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto } from '../dtos/change-password.dto';

/**
 * Validates new password format using ChangePasswordDto rules.
 */
export async function validateNewPasswordFormat(changePasswordDto: ChangePasswordBasicDto) {
  const fullDto = plainToClass(ChangePasswordDto, changePasswordDto);
  const errors = await validate(fullDto);

  if (errors.length > 0) {
    const formattedErrors = errors.map((err) => ({
      property: err.property,
      constraints: err.constraints || {},
    }));

    throw new HttpException({ message: formattedErrors }, HttpStatus.BAD_REQUEST);
  }
}
