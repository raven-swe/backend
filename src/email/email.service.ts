import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  ChangePasswordJob,
  EmailOtpJob,
  ForgotPasswordOtpJob,
  OtpEmailOptions,
  OtpType,
  UpdateEmailOtpJob,
  UpdateEmailJob,
} from './interfaces/email.interfaces';
import { maskEmail } from 'src/users/utils/mask-email.util';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private from: string;
  private name: string;

  constructor(configService: ConfigService) {
    // Cast to nodemailer.TransportOptions so TypeScript recognizes SMTP-specific fields like `host`
    this.from = configService.get<string>('MAIL_FROM')!;
    this.name = configService.get<string>('MAIL_NAME')!;
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

  /**
   * Generic function that returns email template according to the email type
   */
  getEmailTemplate(
    type: OtpType,
    username?: string,
    otp?: string,
    email?: string,
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
      [OtpType.CHANGE_EMAIL]: {
        subject: 'Confirm your email address',
        html: `
          <h1>Confirm your email address</h1>
          <p>There's one quick step you need to complete in order to confirm your email address.</p>
          <p>Please enter this verification code on Raven when prompted</p>
          <p><strong>${otp}</strong></p>
          <p>This code will expire in 5 minutes.</p>
        `,
      },
      [OtpType.CHANGE_EMAIL_COMPLETE]: {
        subject: `Email address changed`,
        html: `
          <h1>Your email address has been changed</h1>
          <p>The email address on your account @${username} has changed to ${email}</p>
        `,
      },
    };

    return templates[type];
  }

  async sendEmail(email: string, subject: string, html: string): Promise<void> {
    const mailOptions = {
      from: `${this.name} <${this.from}>`,
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

  async sendVerifyEmailUpdate({ email, otp }: UpdateEmailOtpJob): Promise<void> {
    const { subject, html } = this.getEmailTemplate(OtpType.CHANGE_EMAIL, undefined, otp);
    await this.sendEmail(email, subject, html);
  }

  async sendCompleteEmailUpdate({ email, oldEmail, username }: UpdateEmailJob): Promise<void> {
    const maskedEmail = maskEmail(email);

    const { subject, html } = this.getEmailTemplate(
      OtpType.CHANGE_EMAIL_COMPLETE,
      username,
      undefined,
      maskedEmail,
    );
    await this.sendEmail(oldEmail, subject, html);
  }
}
