import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LanguageCode } from '@prisma/client';
import { OtpFailedException } from 'src/auth/exceptions/otp.exception';
import { AUTH_ERROR_MESSAGES } from 'src/common/constants/auth.constants';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return await this.prisma.users.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return await this.prisma.users.findUnique({ where: { username } });
  }

  async findById(id: bigint) {
    return await this.prisma.users.findUnique({ where: { id } });
  }

  async findByIdentifier(identifier: string) {
    return await this.prisma.users.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });
  }

  async createUser({
    email,
    password,
    birthDate,
    languageCode,
  }: {
    email: string;
    username: string;
    password: string;
    birthDate: Date;
    languageCode: LanguageCode;
  }) {
    return await this.prisma.users.create({
      data: {
        email,
        username: email,
        password_hash: password,
        language_code: languageCode,
        birthdate: birthDate,
      },
    });
  }

  async updatePasswordById(userId: bigint, hashedPassword: string) {
    await this.prisma.users.update({
      where: { id: userId },
      data: { password_hash: hashedPassword },
    });
  }

  async updateUserEmail(
    userId: bigint,
    emailUpdateData: {
      userId: string;
      otp: string;
      newEmail: string;
      verified: boolean;
    },
  ) {
    if (!emailUpdateData.verified) {
      throw new OtpFailedException(AUTH_ERROR_MESSAGES.OTP_NOT_VERIFIED);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user_external_accounts.deleteMany({ where: { user_id: userId } });

      await tx.users.update({
        where: { id: userId },
        data: {
          email: emailUpdateData.newEmail,
        },
      });
    });
  }
}
