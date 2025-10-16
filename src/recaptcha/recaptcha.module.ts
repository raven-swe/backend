import { Logger, Module } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';
import { HttpService } from '@nestjs/axios';

@Module({
  providers: [RecaptchaService, Logger, HttpService],
})
export class RecaptchaModule {}
