import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LanguageCode } from '@prisma/client';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UserProfileResponseDto } from './dtos/user-profile-response.dto';

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
    // TODO: profile should be created automatically on user creation
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

  async findUserProfileByUsername(
    username: string,
    currentUserId?: bigint,
  ): Promise<UserProfileResponseDto | null> {
    const user = await this.prisma.users.findUnique({
      where: { username },
      include: {
        profile: true,
        _count: {
          select: {
            following: true,
            followers: true,
          },
        },
      },
    });

    if (!user) return null;

    // Get relationship if currentUserId is provided
    let relationship = {
      blocking: false,
      blockedBy: false,
      following: false,
      follower: false,
      muted: false,
    };

    // TODO: convert to "let" after implementing mutual followers
    const mutualsCount: number | null = 2;
    const mutualNames: string[] | null = ['Omar', 'Tasneem'];

    if (currentUserId) {
      // Check if current user is following this user
      const isFollowing = await this.prisma.follows.findUnique({
        where: {
          follower_id_followed_id: {
            follower_id: currentUserId,
            followed_id: user.id,
          },
        },
      });

      // Check if this user is following current user
      const isFollower = await this.prisma.follows.findUnique({
        where: {
          follower_id_followed_id: {
            follower_id: user.id,
            followed_id: currentUserId,
          },
        },
      });

      // Check if current user is blocking this user
      const isBlocking = await this.prisma.blocks.findUnique({
        where: {
          user_id_blocked_id: {
            user_id: currentUserId,
            blocked_id: user.id,
          },
        },
      });

      // Check if the user is blocking current user
      const isBlockedBy = await this.prisma.blocks.findUnique({
        where: {
          user_id_blocked_id: {
            user_id: user.id,
            blocked_id: currentUserId,
          },
        },
      });

      // Check if the current user has muted this user
      const isMuted = await this.prisma.mutes.findUnique({
        where: {
          user_id_muted_id: {
            user_id: currentUserId,
            muted_id: user.id,
          },
        },
      });

      relationship = {
        blocking: !!isBlocking,
        blockedBy: !!isBlockedBy,
        following: !!isFollowing,
        follower: !!isFollower,
        muted: !!isMuted,
      };

      // TODO: Get mutual followers count and names
    }

    return {
      username: user.username,
      // TODO: profile should be created automatically on user creation
      displayName: user.profile?.display_name || '',
      bio: user.profile?.bio || null,
      // TODO: return actual bio entities after implementing rich text bios
      bioEntities: null,
      location: user.profile?.location || null,
      birthDate: user.birthdate,
      avatarUrl: user.profile?.avatar_url || null,
      bannerUrl: user.profile?.banner_url || null,
      websiteUrl: user.profile?.website_url || null,
      joinedAt: user.created_at,
      relationship,
      followingCount: user._count.following.toString(),
      followersCount: user._count.followers.toString(),

      mutualsCount: mutualsCount ? mutualsCount : null,
      mutualNames,
    };
  }
}
