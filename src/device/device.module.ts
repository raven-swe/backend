import { Logger, Module } from '@nestjs/common';
import { DevicesService } from './device.service';
import { DevicesRepository } from './device.repository';

@Module({
  providers: [DevicesService, DevicesRepository, Logger],
  exports: [DevicesService],
})
export class DevicesModule {}
