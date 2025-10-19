import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  public readonly errorCode: string;

  constructor(message: string, status: HttpStatus, errorCode: string) {
    super(message, status);
    this.errorCode = errorCode;
  }

  override getResponse(): object {
    return {
      message: this.message,
      // so the global filter can pick up 'code'
      code: this.errorCode,
    };
  }
}
