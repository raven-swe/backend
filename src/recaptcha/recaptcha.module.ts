import { Logger, Module } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';
import { HttpModule } from '@nestjs/axios';
@Module({
  imports: [HttpModule],
  providers: [RecaptchaService, Logger],
  exports: [RecaptchaService],
})
export class RecaptchaModule {}
