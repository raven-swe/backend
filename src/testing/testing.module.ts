import { Module } from '@nestjs/common';
import { TestController } from './testing.controller';
import { TestService } from './testing.service';

@Module({
  controllers: [TestController],
  providers: [TestService],
})
export class TestingModule {}
