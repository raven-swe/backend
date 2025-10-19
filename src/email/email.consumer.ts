import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EmailOtpJob, EmailService, ForgotPasswordOtpJob, OtpType } from './email.service';
import { Job } from 'bullmq';

export type EmailJobData =
  | ({ type: OtpType.REGISTRATION } & EmailOtpJob)
  | ({ type: OtpType.FORGOT_PASSWORD } & ForgotPasswordOtpJob);

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
      const { type, ...otpData } = job.data;

      if (type === OtpType.REGISTRATION) {
        await this.emailService.sendRegistrationOtp(otpData as EmailOtpJob);
      } else if (type === OtpType.FORGOT_PASSWORD) {
        await this.emailService.sendForgotPasswordOtp(otpData as ForgotPasswordOtpJob);
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
