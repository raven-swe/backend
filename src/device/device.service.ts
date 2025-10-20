import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { DevicesRepository } from './device.repository';
import { Device } from './interfaces/device.interface';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createDevice(device: Device, tx: Prisma.TransactionClient = this.prisma) {
    const newDevice = await this.devicesRepository.createDevice(device, tx);
    this.logger.log('Device created successfully for user ID: ' + device.userId);
    return newDevice;
  }
}
