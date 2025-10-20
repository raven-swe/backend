export interface RefreshToken {
  userId: bigint;
  deviceId: bigint;
  tokenHash: string;
  expiresAt: Date;
}
