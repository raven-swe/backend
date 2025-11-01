export interface CreateMentionData {
  userId: bigint;
  startingIndex: number;
}

export interface CreateHashtagData {
  hashtagId: bigint;
  startingIndex: number;
}

export interface CreateTweetData {
  userId: bigint;
  content: string;

  Mentions: CreateMentionData[];
  Hashtags: CreateHashtagData[];

  replyToTweetId?: bigint;
  quotedTweetId?: bigint;
}
