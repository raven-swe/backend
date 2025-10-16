import { Logger, Module } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';
import { HttpService } from '@nestjs/axios';
import { RecaptchaGuard } from './recaptcha.guard';

@Module({
  providers: [RecaptchaService, Logger, HttpService],
  exports: [RecaptchaGuard],
})
export class RecaptchaModule {}
