import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { MeController } from './me/me.controller';
import { SettingsController } from './me/settings/settings.controller';
import { SettingsService } from './me/settings/settings.service';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from 'src/redis/redis.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MediaModule } from 'src/media/media.module';
import { MentionsController } from './mentions/mentions.controller';

@Module({
  controllers: [UsersController, MeController, SettingsController, MentionsController],
  providers: [UsersService, UsersRepository, SettingsService],
  exports: [UsersService, UsersRepository],
  imports: [
    BullModule.registerQueue({
      name: 'email',
    }),
    RedisModule,
    PrismaModule,
    MediaModule,
  ],
})
export class UsersModule {}
