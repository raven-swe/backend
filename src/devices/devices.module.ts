import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesRepository } from './devices.repository';
import { DevicesController } from './devices.controller';

@Module({
  providers: [DevicesService, DevicesRepository],
  exports: [DevicesService],
  controllers: [DevicesController],
})
export class DevicesModule {}
