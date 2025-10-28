import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { NewUser } from './interfaces/NewUser.interface';

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

  async createUser(newUser: NewUser, prismaClient: Prisma.TransactionClient = this.prisma) {
    const { email, passwordHash, username, languageCode, birthDate } = newUser;
    return await prismaClient.users.create({
      data: {
        email,
        username: username,
        password_hash: passwordHash,
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
}
