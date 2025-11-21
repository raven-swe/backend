import { Module } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { TimelineController } from './timeline.controller';
import { UsersRepository } from 'src/users/users.repository';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [BullModule.registerQueue({ name: 'timeline-following' }), UsersRepository],
  providers: [TimelineService, TimelineController],
})
export class TimelineModule {}
