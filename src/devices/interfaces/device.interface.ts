export interface Device {
  userId: bigint;
  ipAddress: string;
  deviceType: DeviceType;
}

export enum DeviceType {
  MOBILE = 'MOBILE',
  WEB = 'WEB',
}
