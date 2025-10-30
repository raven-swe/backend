import { Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { EmailConsumer } from './email.consumer';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email',
    }),
  ],

  providers: [EmailService, EmailConsumer, Logger],
})
export class EmailModule {}
