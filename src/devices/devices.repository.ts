import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DevicesRepository {
  private readonly logger = new Logger(DevicesRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async removeAllUserDevices(userId: bigint) {
    const deletedCount = await this.prisma.user_devices.deleteMany({
      where: { user_id: userId },
    });

    return deletedCount;
  }
}
