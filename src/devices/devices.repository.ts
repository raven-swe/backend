import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Device } from '../devices/interfaces/device.interface';
import { Prisma } from '@prisma/client';

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

  //allows passing a transactional client, service is responsible for this, else it defaults to normal prisma client
  async createDevice(device: Device, prismaClient: Prisma.TransactionClient = this.prisma) {
    const { userId, ipAddress, deviceType } = device;
    return prismaClient.userDevice.create({
      data: {
        userId: userId,
        ipAddress: ipAddress,
        deviceType: deviceType,
      },
    });
  }
}
