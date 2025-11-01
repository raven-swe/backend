import type { Follow } from '@prisma/client';

export type FollowsCursor = Pick<Follow, 'followerId' | 'followedId'>;

export const encodeCursor = (id: string) => Buffer.from(id).toString('base64');
export const decodeCursor = (cursor: string) => Buffer.from(cursor, 'base64').toString('utf-8');
export const encodeCompositeCursor = (cursorObject: object): string => {
  const jsonString = JSON.stringify(cursorObject);
  return Buffer.from(jsonString).toString('base64');
};

export const decodeCompositeCursor = <T>(cursorString: string): T => {
  const jsonString = Buffer.from(cursorString, 'base64').toString('utf-8');
  return JSON.parse(jsonString) as T;
};
