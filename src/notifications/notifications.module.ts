import { forwardRef, Module } from '@nestjs/common';
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
import { FirebaseModule } from 'src/firebase/firebase.module';

@Module({
  imports: [
    TweetsModule,
    forwardRef(() => SseModule),
    UsersModule,
    DevicesModule,
    BullModule.registerQueue({ name: 'notifications' }),
    FirebaseModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsListeners,
    NotificationProcessor,
  ],
  exports: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
