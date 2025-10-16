import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';
import { Request } from 'express';

@Injectable()
export class RecaptchaGuard implements CanActivate {
  constructor(private readonly recaptchaService: RecaptchaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const recaptchaToken: string = (request.body as { recaptchaToken: string }).recaptchaToken;

    const valid = await this.recaptchaService.validateToken(recaptchaToken);
    if (!valid) {
      throw new BadRequestException('Failed to verify reCAPTCHA token');
    }
    return true;
  }
}
