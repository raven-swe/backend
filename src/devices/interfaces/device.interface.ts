export interface Device {
  userId: bigint;
  fcmToken: string;
  ipAddress?: string;
  deviceType?: string;
}
