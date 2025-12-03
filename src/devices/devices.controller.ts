import { Body, Controller, Post, Put, UseGuards } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dtos';
import { JwtAuthGuard } from 'src/auth/guards';
import { DeviceType, IPAddress, User } from 'src/auth/decorators';
import type { RequestUser } from 'src/common/interfaces';
import { ToggleNotificationsDto } from './dtos/toggle-notifications.dto';

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
    await this.devicesService.registerDevice({
      fcmToken: deviceDto.fcmToken,
      userId: BigInt(user.id),
      ipAddress,
      deviceType,
    });
    return { message: 'Device registered successfully for push notifications.' };
  }

  @Put('toggle-push')
  async togglePushNotifications(
    @User() user: RequestUser,
    @Body() deviceDto: ToggleNotificationsDto,
  ) {
    await this.devicesService.togglePushNotifications(
      deviceDto.fcmToken,
      BigInt(user.id),
      deviceDto.enable,
    );
    return {
      message: `Push notifications ${deviceDto.enable ? 'enabled' : 'disabled'} successfully.`,
    };
  }
}
