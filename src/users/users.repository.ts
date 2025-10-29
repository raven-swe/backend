import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { NewUser } from './interfaces/NewUser.interface';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UserProfileResponseDto, UserRelationshipDto } from './dtos/user-profile-response.dto';
import { DEFAULT_PROFILE_PICTURE } from './constants/users';

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

  async updateProfile(userId: bigint, data: UpdateProfileDto) {
    return await this.prisma.$transaction(async (tx) => {
      let birthDate: string | undefined = undefined;

      // Update birthDate in users table if provided
      if (data.birthDate !== undefined) {
        const updatedUser = await tx.users.update({
          where: { id: userId },
          data: { birthdate: data.birthDate },
        });
        birthDate = updatedUser.birthdate?.toISOString().split('T')[0];
      }

      // Build prismaData conditionally
      const prismaData: Prisma.profilesUpdateInput = {};
      if (data.displayName !== undefined) prismaData.display_name = data.displayName;
      if (data.bio !== undefined) prismaData.bio = data.bio;
      if (data.location !== undefined) prismaData.location = data.location;
      if (data.websiteUrl !== undefined) prismaData.website_url = data.websiteUrl;
      if (data.avatarUrl !== undefined) prismaData.avatar_url = data.avatarUrl;
      if (data.bannerUrl !== undefined) prismaData.banner_url = data.bannerUrl;

      // Only update if there are fields to update
      let profile;
      if (Object.keys(prismaData).length > 0) {
        profile = await tx.profiles.update({
          where: { user_id: userId },
          data: prismaData,
        });
      } else {
        // If no profile fields to update, just fetch the existing profile
        profile = await tx.profiles.findUnique({
          where: { user_id: userId },
        });
      }

      if (!profile) {
        throw new Error(`Profile not found for user ${userId}`);
      }

      // Map profile fields to return
      return {
        displayName: profile.display_name,
        bio: profile.bio,
        bioEntities: profile.bio_entities,
        location: profile.location,
        birthDate,
        websiteUrl: profile.website_url,
        avatarUrl: profile.avatar_url || DEFAULT_PROFILE_PICTURE,
        bannerUrl: profile.banner_url,
        updatedAt: profile.updated_at,
      };
    });
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

    // TODO: change is_deleted to deleted_at after migrating the database
    if (!user || user.is_deleted) return null;

    // Get relationship if currentUserId is provided
    let relationship: UserRelationshipDto | null = null;

    // TODO: convert to "let" after implementing mutual followers
    const mutualsCount: number | null = 2;
    const mutualNames: string[] | null = ['Omar', 'Tasneem'];

    // Get relationship status only if currentUserId is provided and is different from the profile user
    if (currentUserId && currentUserId !== user.id) {
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
      birthDate: user.birthdate.toISOString().split('T')[0] || null,
      avatarUrl: user.profile?.avatar_url || DEFAULT_PROFILE_PICTURE,
      bannerUrl: user.profile?.banner_url || null,
      websiteUrl: user.profile?.website_url || null,
      joinedAt: user.created_at,
      relationship,
      followingCount: user._count.following,
      followersCount: user._count.followers,

      mutualsCount: mutualsCount ? mutualsCount : null,
      mutualNames,
    };
  }

  async updateUsernameById(userId: bigint, newUsername: string) {
    await this.prisma.users.update({
      where: { id: userId },
      data: { username: newUsername },
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
