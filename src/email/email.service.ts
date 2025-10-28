import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  ChangePasswordJob,
  EmailOtpJob,
  ForgotPasswordOtpJob,
  OtpEmailOptions,
  OtpType,
} from './interfaces/email.interfaces';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: configService.get<string>('SMTP_HOST'),
      port: configService.get<number>('SMTP_PORT'),
      secure: false,
      tls: { rejectUnauthorized: false },
      auth: {
        user: configService.get<string>('SMTP_USER'),
        pass: configService.get<string>('SMTP_PASS'),
      },
    });
  }

  /**
   * Generic function that returns email template according to the email type
   */
  getEmailTemplate(
    type: OtpType,
    username?: string,
    otp?: string,
  ): { subject: string; html: string } {
    const templates: Record<OtpType, { subject: string; html: string }> = {
      [OtpType.REGISTRATION]: {
        subject: 'Your One-Time Password (OTP) - Welcome to Raven',
        html: `<h1>Welcome to Raven!</h1>
          <p>Thank you for signing up. Your One-Time Password (OTP) is:</p>
          <p><strong>${otp}</strong></p>
          <p>This code will expire in 5 minutes.</p>`,
      },
      [OtpType.FORGOT_PASSWORD]: {
        subject: 'Your One-Time Password (OTP) - Password Reset',
        html: `<h1>Reset your password?</h1>
          <p>If you requested a password reset for ${username}, use the confirmation code below to complete the process.</p>
          <p><strong>${otp}</strong></p>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this, please ignore this email or contact support.</p>`,
      },
      [OtpType.CHANGE_PASSWORD]: {
        subject: 'Your Raven password has been changed',
        html: `<h1>Password Changed Successfully</h1>
          <p>You recently changed the password associated with your account ${username}.</p>
          <p>If you did not make this change, and believe your Raven account has been compromised, please contact support.</p>`,
      },
    };

    return templates[type];
  }

  async sendEmail(email: string, subject: string, html: string): Promise<void> {
    const mailOptions = {
      from: '"Raven Support" <no-reply@raven.com>',
      to: email,
      subject,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${email} - Subject: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error);
      throw error;
    }
  }

  async sendOtpEmail({ email, otp, type, username }: OtpEmailOptions): Promise<void> {
    const { subject, html } = this.getEmailTemplate(type, username, otp);
    await this.sendEmail(email, subject, html);
  }

  async sendRegistrationOtp({ email, otp }: EmailOtpJob): Promise<void> {
    await this.sendOtpEmail({ email, otp, type: OtpType.REGISTRATION });
  }

  async sendForgotPasswordOtp({ email, otp, username }: ForgotPasswordOtpJob): Promise<void> {
    await this.sendOtpEmail({ email, otp, type: OtpType.FORGOT_PASSWORD, username });
  }

  async sendChangePasswordEmail({ email, username }: ChangePasswordJob): Promise<void> {
    const { subject, html } = this.getEmailTemplate(OtpType.CHANGE_PASSWORD, username);
    await this.sendEmail(email, subject, html);
  }
}
