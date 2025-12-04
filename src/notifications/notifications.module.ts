import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { TweetsModule } from 'src/tweets/tweets.module';
import { SseModule } from 'src/sse/sse.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [TweetsModule, SseModule, BullModule.registerQueue({ name: 'notifications' })],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
