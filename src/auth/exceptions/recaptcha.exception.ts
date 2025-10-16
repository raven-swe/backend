import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';

export class RecaptchaFailedException extends AppException {
  constructor() {
    super('Invalid reCAPTCHA token', HttpStatus.BAD_REQUEST, 'RECAPTCHA_FAILED');
  }
}
