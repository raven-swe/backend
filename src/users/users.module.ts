import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { MeController } from './me.controller';
import { BullModule } from '@nestjs/bullmq';
@Module({
  controllers: [UsersController, MeController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
  imports: [
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
})
export class UsersModule {}
