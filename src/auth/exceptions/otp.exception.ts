import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';

export class OtpFailedException extends AppException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST, 'OTP_INVALID');
  }
}
