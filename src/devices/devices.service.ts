import { Injectable, Logger } from '@nestjs/common';
import { DevicesRepository } from './devices.repository';
import { Device } from '../devices/interfaces';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Remove all devices for a user (used during password reset)
   */
  async removeAllUserDevices(userId: bigint) {
    return this.devicesRepository.removeAllUserDevices(userId);
  }

  async createDevice(device: Device, tx: Prisma.TransactionClient = this.prisma) {
    const newDevice = await this.devicesRepository.createDevice(device, tx);
    this.logger.log('Device created successfully for user ID: ' + device.userId);
    return newDevice;
  }
}
