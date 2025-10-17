import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { LanguageCode } from '@prisma/client';
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async createUser(data: {
    email: string;
    username: string;
    password: string;
    birthDate: Date;
    languageCode: LanguageCode;
  }) {
    return this.usersRepository.createUser(data);
  }
}
