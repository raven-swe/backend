import { Controller, Get, Query } from '@nestjs/common';
import { TestService } from './testing.service';
import { GetOtpDto } from './dtos/get-otp.dto';

@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Get('otp')
  async getOtpForTesting(@Query() getOtpDto: GetOtpDto) {
    return this.testService.getOtp(getOtpDto);
  }
}
