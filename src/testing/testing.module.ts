import { Module } from '@nestjs/common';
import { TestController } from './testing.controller';
import { TestService } from './testing.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [TestController],
  providers: [TestService],
})
export class TestingModule {}
