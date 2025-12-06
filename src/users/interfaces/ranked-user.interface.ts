import { Prisma } from '@prisma/client';

export interface RankedUser {
  id: bigint;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  created_at: Date;
  bio_entities: Prisma.JsonValue | null;
  sim_score: number;
  followers_count: bigint;
  i_follow: boolean;
  follows_me: boolean;
  ranking_score: bigint;
}
