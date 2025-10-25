import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Device } from './interfaces/device.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  //allows passing a transactional client, service is responsible for this, else it defaults to normal prisma client
  async createDevice(device: Device, prismaClient: Prisma.TransactionClient = this.prisma) {
    const { userId, ipAddress, deviceType } = device;
    return prismaClient.user_devices.create({
      data: {
        user_id: userId,
        ip_address: ipAddress,
        device_type: deviceType,
      },
    });
  }
}
