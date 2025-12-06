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
  ranking_score: bigint;
  sim_username: number;
  sim_display_name: number;
}
