import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import {
  EmailOtpJob,
  ForgotPasswordOtpJob,
  OtpType,
  EmailJobData,
  ChangePasswordJob,
  UpdateEmailOtpJob,
  UpdateEmailJob,
} from './interfaces/email.interfaces';
import { Job } from 'bullmq';
import { EmailService } from './email.service';

@Processor('email')
export class EmailConsumer extends WorkerHost {
  constructor(
    private readonly emailService: EmailService,
    private readonly logger: Logger,
  ) {
    super();
  }

  async process(job: Job<EmailJobData, void, string>): Promise<void> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    try {
      const { type, ...data } = job.data;

      if (type === OtpType.REGISTRATION) {
        await this.emailService.sendRegistrationOtp(data as EmailOtpJob);
      } else if (type === OtpType.FORGOT_PASSWORD) {
        await this.emailService.sendForgotPasswordOtp(data as ForgotPasswordOtpJob);
      } else if (type === OtpType.CHANGE_PASSWORD) {
        await this.emailService.sendChangePasswordEmail(data as ChangePasswordJob);
      } else if (type === OtpType.CHANGE_EMAIL) {
        await this.emailService.sendVerifyEmailUpdate(data as UpdateEmailOtpJob);
      } else if (type === OtpType.CHANGE_EMAIL_COMPLETE) {
        await this.emailService.sendCompleteEmailUpdate(data as UpdateEmailJob);
      } else {
        throw new Error('Unknown OTP type');
      }

      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (err) {
      this.logger.error(`Job ${job.id} failed`, err instanceof Error ? err.stack : String(err));
      throw err; // for bullmq to handle it
    }
  }
}
