import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { NewUser } from './interfaces/NewUser.interface';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return await this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: bigint) {
    return await this.prisma.user.findUnique({ where: { id } });
  }

  async findByIdentifier(identifier: string) {
    return await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });
  }

  async createUser(newUser: NewUser, prismaClient: Prisma.TransactionClient = this.prisma) {
    const { email, passwordHash, username, languageCode, birthDate } = newUser;
    return await prismaClient.user.create({
      data: {
        email,
        username: username,
        passwordHash: passwordHash,
        languageCode: languageCode,
        birthdate: birthDate,
      },
    });
  }

  async updatePasswordById(userId: bigint, hashedPassword: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });
  }

  async updateUsernameById(userId: bigint, newUsername: string) {
    await this.prisma.user.update({
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
      await tx.userExternalAccount.deleteMany({ where: { userId } });

      await tx.user.update({
        where: { id: userId },
        data: {
          email: emailUpdateData.newEmail,
        },
      });
    });
  }

  async followUser(followerId: bigint, followedId: bigint) {
    await this.prisma.follow.create({
      data: {
        followerId,
        followedId,
      },
    });
  }

  async unfollowUser(followerId: bigint, followedId: bigint) {
    await this.prisma.follow.delete({
      where: {
        followerId_followedId: {
          followerId,
          followedId,
        },
      },
    });
  }

  async isFollowing(followerId: bigint, followedId: bigint) {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followedId: {
          followerId,
          followedId,
        },
      },
    });
    return !!follow;
  }

  /**
   * Blocks a user and removes any existing follow relationships between the users.
   */
  async blockUser(userId: bigint, blockedId: bigint) {
    await this.prisma.$transaction(async (tx) => {
      await tx.block.create({
        data: {
          userId,
          blockedId,
        },
      });

      // Remove follow relationships in both directions
      await tx.follow.deleteMany({
        where: {
          OR: [
            { followerId: userId, followedId: blockedId },
            { followerId: blockedId, followedId: userId },
          ],
        },
      });
    });
  }

  async unblockUser(userId: bigint, blockedId: bigint) {
    await this.prisma.block.delete({
      where: {
        userId_blockedId: {
          userId,
          blockedId,
        },
      },
    });
  }

  async isBlocked(userId: bigint, blockedId: bigint) {
    const block = await this.prisma.block.findUnique({
      where: {
        userId_blockedId: {
          userId,
          blockedId,
        },
      },
    });
    return !!block;
  }

  async muteUser(userId: bigint, mutedId: bigint) {
    await this.prisma.mute.create({
      data: {
        userId,
        mutedId,
      },
    });
  }

  async unmuteUser(userId: bigint, mutedId: bigint) {
    await this.prisma.mute.delete({
      where: {
        userId_mutedId: {
          userId,
          mutedId,
        },
      },
    });
  }

  async isMuted(userId: bigint, mutedId: bigint) {
    const mute = await this.prisma.mute.findUnique({
      where: {
        userId_mutedId: {
          userId,
          mutedId,
        },
      },
    });
    return !!mute || this.isBlocked(userId, mutedId);
  }
}
