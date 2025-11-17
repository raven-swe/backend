export interface CachedRegistrationData {
  email: string;
  name: string;
  birthDate: Date;
  otp: string;
  verified: boolean; // otp state
}
