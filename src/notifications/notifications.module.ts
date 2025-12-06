import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { TweetsModule } from 'src/tweets/tweets.module';
import { SseModule } from 'src/sse/sse.module';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsListeners } from './notifications.listeners';
import { NotificationProcessor } from './notifications.processor';
import { DevicesModule } from 'src/devices/devices.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TweetsModule,
    SseModule,
    UsersModule,
    DevicesModule,
    BullModule.registerQueue({ name: 'notifications' }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsListeners,
    NotificationProcessor,
  ],
})
export class NotificationsModule {}
