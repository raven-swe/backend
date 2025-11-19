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
  async createUserForTesting() {
    const result = await this.testService.createUser();
    return {
      id: result.id.toString(),
      username: result.username,
      email: result.email,
      password: result.password,
      passwordHash: result.passwordHash,
      birthdate: result.birthdate,
      createdAt: result.createdAt,
    };
  }
}
