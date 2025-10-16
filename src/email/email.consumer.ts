import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { Job } from 'bullmq';
import { EmailOtpJob } from './email.service';

@Processor('email')
export class EmailConsumer extends WorkerHost {
  constructor(
    private readonly EmailService: EmailService,
    private readonly logger: Logger,
  ) {
    super();
  }

  async process(job: Job<EmailOtpJob, void, string>): Promise<void> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    try {
      await this.EmailService.sendRegistrationOtp(job.data);
      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (err) {
      this.logger.error(`Job ${job.id} failed`, err instanceof Error ? err.stack : String(err));
      throw err; // for bullmq to handle it
    }
  }
}
