import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TestService } from './testing.service';
import { GetOtpDto } from './dtos/get-otp.dto';

@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Get('otp')
  async getOtpForTesting(@Query() getOtpDto: GetOtpDto) {
    return this.testService.getOtp(getOtpDto);
  }

  @Post('users')
  async createUserForTesting(@Body() body: { username: string; email: string; password: string }) {
    const { username, email, password } = body;
    return this.testService.createUser(username, email, password);
  }
}
