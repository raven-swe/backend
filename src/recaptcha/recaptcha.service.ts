import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

interface RecaptchaResponse {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  'error-codes'?: string[];
}

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly secretKey: string;
  private readonly recaptchaVerifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    const env = configService.get<string>('NODE_ENV', 'development');
    let secret;
    if (env === 'development' || env === 'testing') {
      secret = configService.get<string>('RECAPTCHA_SECRET_KEY_TEST');
    } else secret = configService.get<string>('RECAPTCHA_SECRET_KEY');
    if (!secret) {
      throw new Error('Secret key is not defined in configuration');
    }
    this.secretKey = secret;
  }

  async validateToken(token: string): Promise<boolean> {
    if (!token) {
      this.logger.warn('No reCAPTCHA token provided');
      return false;
    }

    this.logger.debug(`Validating reCAPTCHA token: ${token}`);

    //http service returns an Observable, this converts it to a promise
    //I use it as it can be mocked in tests
    try {
      const payload = new URLSearchParams({
        secret: this.secretKey,
        response: token,
      }).toString();
      const response = await firstValueFrom(
        this.httpService.post<RecaptchaResponse>(this.recaptchaVerifyUrl, payload, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      this.logger.log(JSON.stringify(response.data));
      this.logger.debug(`reCAPTCHA validation response received ${JSON.stringify(response.data)}`);

      if (!response.data.success) {
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('Error while validating reCAPTCHA token', error);
      return false;
    }
  }
}
