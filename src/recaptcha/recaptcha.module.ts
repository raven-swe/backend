import { Logger, Module } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';
import { RecaptchaGuard } from './recaptcha.guard';
import { HttpModule } from '@nestjs/axios';
@Module({
  imports: [HttpModule],
  providers: [RecaptchaService, RecaptchaGuard, Logger],
  exports: [RecaptchaGuard, RecaptchaService],
})
export class RecaptchaModule {}
