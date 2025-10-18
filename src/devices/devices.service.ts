import { Injectable } from '@nestjs/common';
import { DevicesRepository } from './devices.repository';

@Injectable()
export class DevicesService {
  constructor(private readonly devicesRepository: DevicesRepository) {}

  /**
   * Remove all devices for a user (used during password reset)
   */
  async removeAllUserDevices(userId: bigint) {
    return this.devicesRepository.removeAllUserDevices(userId);
  }
}
