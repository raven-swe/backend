import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailOtpJob {
  email: string;
  otp: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(configService: ConfigService) {
    // Cast to nodemailer.TransportOptions so TypeScript recognizes SMTP-specific fields like `host`
    this.transporter = nodemailer.createTransport({
      host: configService.get<string>('SMTP_HOST'),
      port: configService.get<number>('SMTP_PORT'),
      secure: false,
      tls: { rejectUnauthorized: false },
      auth: {
        user: configService.get<string>('SMTP_USER'),
        pass: configService.get<string>('SMTP_PASS'),
      },
    } as nodemailer.TransportOptions);
  }

  async sendRegistrationOtp({ email, otp }: EmailOtpJob): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM || '',
      to: email,
      subject: 'Your One-Time Password (OTP)',
      html: `<h1>Welcome to Raven!</h1>
          <p>Your OTP is: <strong>${otp}</strong></p>
          <p>This code will expire in 5 minutes.</p>`,
    };
    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`OTP email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}`, error);
      throw error;
    }
  }
}
