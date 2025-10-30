export interface EmailOtpJob {
  email: string;
  otp: string;
}

export interface ForgotPasswordOtpJob {
  email: string;
  otp: string;
  username: string;
}

export interface ChangePasswordJob {
  email: string;
  username: string;
}

export interface UpdateEmailOtpJob {
  email: string;
  otp: string;
}

export interface UpdateEmailJob {
  email: string;
  oldEmail: string;
  username: string;
}

export enum OtpType {
  REGISTRATION = 'registration',
  FORGOT_PASSWORD = 'forgotPassword',
  CHANGE_PASSWORD = 'changePassword',
  CHANGE_EMAIL = 'changeEmail',
  CHANGE_EMAIL_COMPLETE = 'changeEmailComplete',
}

export interface OtpEmailOptions extends EmailOtpJob {
  type: OtpType;
  username?: string;
}

export type EmailJobData =
  | ({ type: OtpType.REGISTRATION } & EmailOtpJob)
  | ({ type: OtpType.FORGOT_PASSWORD } & ForgotPasswordOtpJob)
  | ({ type: OtpType.CHANGE_PASSWORD } & ChangePasswordJob)
  | ({ type: OtpType.CHANGE_EMAIL } & UpdateEmailOtpJob)
  | ({ type: OtpType.CHANGE_EMAIL_COMPLETE } & UpdateEmailJob);
