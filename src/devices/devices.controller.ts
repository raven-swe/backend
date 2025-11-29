import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dtos';
import { JwtAuthGuard } from 'src/auth/guards';
import { DeviceType, IPAddress, User } from 'src/auth/decorators';
import type { RequestUser } from 'src/common/interfaces';

@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}
  @Post()
  async registerDevice(
    @User() user: RequestUser,
    @IPAddress() ipAddress: string,
    @DeviceType() deviceType: string,
    @Body() deviceDto: RegisterDeviceDto,
  ) {
    return this.devicesService.registerDevice({
      fcmToken: deviceDto.fcmToken,
      userId: BigInt(user.id),
      ipAddress,
      deviceType,
    });
  }
}
