import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LanguageCode } from '@prisma/client';
import { UpdateProfileDto } from './dtos/update-profile.dto';

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

  async updateProfile(userId: bigint, data: Partial<UpdateProfileDto>) {
    // Prepare data for Prisma
    const prismaData = {
      display_name: data.displayName,
      bio: data.bio,
      location: data.location,
      website_url: data.websiteUrl,
      avatar_url: data.avatarUrl,
      banner_url: data.bannerUrl,
    };

    const profile = await this.prisma.profiles.upsert({
      where: { user_id: userId },
      update: prismaData,
      create: {
        user_id: userId,
        display_name: data.displayName || '',
        bio: data.bio,
        location: data.location,
        website_url: data.websiteUrl,
        avatar_url: data.avatarUrl,
        banner_url: data.bannerUrl,
      },
    });

    // Map profile fields to return
    return {
      displayName: profile.display_name,
      bio: profile.bio,
      bioEntities: profile.bio_entities,
      location: profile.location,
      websiteUrl: profile.website_url,
      avatarUrl: profile.avatar_url,
      bannerUrl: profile.banner_url,
      updatedAt: profile.updated_at,
    };
  }
}
