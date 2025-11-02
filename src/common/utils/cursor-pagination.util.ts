import { CursorPagination } from '../interfaces/response.interface';

export type FollowsCursor = {
  followerId: string;
  followedId: string;
};

const encodeCursor = (id: string) => Buffer.from(id).toString('base64');
export const decodeCursor = (cursor: string) => Buffer.from(cursor, 'base64').toString('utf-8');
const encodeCompositeCursor = (cursorObject: object): string => {
  const jsonString = JSON.stringify(cursorObject);
  return Buffer.from(jsonString).toString('base64');
};

export const decodeCompositeCursor = <T>(cursorString: string): T => {
  const jsonString = Buffer.from(cursorString, 'base64').toString('utf-8');
  return JSON.parse(jsonString) as T;
};

export const paginateSingle = <T>(
  items: T[],
  limit: number,
  prevCursor: string | undefined,
  getId: (item: T) => bigint | string,
): CursorPagination => {
  const hasNextPage = items.length > limit;
  console.log('items length in paginateSingle:', items.length);
  let nextCursor: string | null = null;

  if (hasNextPage) {
    const nextItem = items.pop();
    if (nextItem) {
      const id = getId(nextItem);
      nextCursor = encodeCursor(id.toString());
    }
  }

  return {
    cursor: prevCursor || null,
    nextCursor,
    hasNextPage,
  };
};

export const paginateComposite = <T, C extends Record<string, unknown>>(
  items: T[],
  limit: number,
  prevCursor: string | undefined,
  getCursorFields: (item: T) => C,
): CursorPagination => {
  const hasNextPage = items.length > limit;
  let nextCursor: string | null = null;

  if (hasNextPage) {
    const nextItem = items.pop();
    if (nextItem) {
      const cursorFields = getCursorFields(nextItem);
      const serializedFields = Object.entries(cursorFields).reduce(
        (acc, [key, value]) => {
          acc[key] = typeof value === 'bigint' ? value.toString() : value;
          return acc;
        },
        {} as Record<string, unknown>,
      );
      nextCursor = encodeCompositeCursor(serializedFields);
    }
  }

  return {
    cursor: prevCursor || null,
    nextCursor,
    hasNextPage,
  };
};
