export interface TweetsBackfill {
  id: bigint;
  authorId: bigint;
  createdAt: Date;
  type: 'T' | 'R';
  retweeterId: bigint | null;
}
