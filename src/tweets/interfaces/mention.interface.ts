export interface Mention {
  userId: bigint;
  startPosition: number;
}

export interface PlainMention {
  username: string;
  startPosition: number;
}
