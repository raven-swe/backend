export interface EmailOtpJob {
  email: string;
  otp: string;
}

export interface ForgotPasswordOtpJob {
  email: string;
  otp: string;
  username: string;
}

export enum OtpType {
  REGISTRATION = 'registration',
  FORGOT_PASSWORD = 'forgotPassword',
}

export interface OtpEmailOptions extends EmailOtpJob {
  type: OtpType;
  username?: string;
}

export type EmailJobData =
  | ({ type: OtpType.REGISTRATION } & EmailOtpJob)
  | ({ type: OtpType.FORGOT_PASSWORD } & ForgotPasswordOtpJob);
