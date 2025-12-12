import { forwardRef, Module } from '@nestjs/common';
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
import { ContentParsingModule } from 'src/content-parsing/content-parsing.module';
import { RefreshTokensModule } from 'src/refresh-tokens/refresh-tokens.module';

@Module({
  controllers: [UsersController, MeController, SettingsController, MentionsController],
  providers: [UsersService, UsersRepository, SettingsService],
  exports: [UsersService, UsersRepository],
  imports: [
    BullModule.registerQueue({
      name: 'email',
    }),
    BullModule.registerQueue({
      name: 'timeline-following',
    }),
    RedisModule,
    PrismaModule,
    MediaModule,
    RefreshTokensModule,
    forwardRef(() => ContentParsingModule),
  ],
})
export class UsersModule {}
