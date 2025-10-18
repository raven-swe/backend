import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesRepository } from './devices.repository';

@Module({
  providers: [DevicesService, DevicesRepository],
  exports: [DevicesService],
})
export class DevicesModule {}
