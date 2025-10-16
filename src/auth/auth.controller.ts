import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { RecaptchaFailedException } from './exceptions/recaptcha.exception';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/start')
  async startRegistration(@Body() startRegistrationDto: StartRegistrationDto) {
    const valid = await this.authService.verifyRecaptcha(startRegistrationDto.recaptchaToken);
    if (!valid) {
      throw new RecaptchaFailedException();
    }
    return this.authService.startRegistration(startRegistrationDto);
  }

  @Post('register/verify')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return await this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('register/complete')
  async completeRegistration(@Body() completeRegistrationDto: CompleteRegistrationDto) {
    return await this.authService.completeRegistration(completeRegistrationDto);
  }
}
