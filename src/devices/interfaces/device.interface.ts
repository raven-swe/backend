export interface Device {
  userId: bigint;
  ipAddress: string;
  deviceType: DeviceType;
}

export enum DeviceType {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
  WEB = 'WEB',
}
