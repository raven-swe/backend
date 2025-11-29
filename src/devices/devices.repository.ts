import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Device } from './interfaces';

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async removeAllUserDevices(userId: bigint) {
    const deletedCount = await this.prisma.$transaction(
      async (prismaClient: Prisma.TransactionClient) => {
        await prismaClient.refreshToken.deleteMany({
          where: { userDevice: { userId: userId } },
        });

        // then delete the devices
        const { count } = await prismaClient.userDevice.deleteMany({
          where: { userId: userId },
        });

        return count;
      },
    );

    return deletedCount;
  }

  async registerDevice(
    { userId, fcmToken, ipAddress, deviceType }: Device,

    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const device = await tx.userDevice.upsert({
      where: { fcmToken },
      update: { userId, ipAddress, deviceType, pushEnabled: true },
      create: {
        userId,
        fcmToken: fcmToken,
        ipAddress,
        deviceType,
      },
    });
    return device;
  }

  async unassignDeviceFromUser(fcmToken: string, tx: Prisma.TransactionClient = this.prisma) {
    await tx.userDevice.update({
      where: {
        fcmToken: fcmToken,
      },
      data: {
        userId: null,
        pushEnabled: false,
      },
    });
    return device;
  }

  async togglePushNotifications(
    fcmToken: string,
    pushEnabled: boolean,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const device = await tx.userDevice.update({
      where: { fcmToken },
      data: { pushEnabled },
    });
    return device;
  }
}
