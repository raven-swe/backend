export interface RefreshToken {
  userId: bigint;
  sessionId: bigint;
  tokenHash: string;
  expiresAt: Date;
}
