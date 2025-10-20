import { LanguageCode } from '@prisma/client';

export interface NewUser {
  email: string;
  passwordHash: string;
  username: string;
  birthDate: Date;
  languageCode: LanguageCode;
}
