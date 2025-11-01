# Cursor-Based Pagination Utilities

A TypeScript utility for encoding/decoding cursor values in pagination, supporting both single-field and composite cursors.

## Usage



### Single-Field Cursors
For tables with a single unique identifier:

```typescript
// Encode
const cursor = encodeCursor('user-123');

// Decode
const id = decodeCursor(cursor);
```

### Composite Cursors
For tables with compound keys (multiple fields as unique identifier):

```typescript
// 1. Define cursor type based on your table's compound key
type FollowsCursor = Pick<Follow, 'followerId' | 'followedId'>;

// 2. Encode
const cursor = encodeCompositeCursor({ 
  followerId: 'user-1', 
  followedId: 'user-2' 
});

// 3. Decode
const decoded = decodeCompositeCursor<FollowsCursor>(cursor);
// decoded = { followerId: 'user-1', followedId: 'user-2' }
```

## When to Use What

- **Single ID?** → Use `encodeCursor()` / `decodeCursor()`
- **Compound keys?** → Create a `Pick<>` type + use `encodeCompositeCursor()` / `decodeCompositeCursor()`

## Pagination Interface

```typescript
export interface CursorPagination {
  cursor?: string | null;
  nextCursor?: string | null;
  hasNextPage: boolean;
}
```

## Service Layer Example

### Single-Field Cursor

```typescript
// Service with single ID cursor
async getUsersPaginated(limit: number, prevCursor?: string) {
  // Decode the cursor
  const decodedCursor = prevCursor ? decodeCursor(prevCursor) : undefined;
  
  // Fetch limit + 1 to check if there's a next page
  const users = await this.repo.getUsers(limit + 1, decodedCursor);
  
  // Check if there are more items
  const hasNextPage = users.length > limit;
  
  // Remove extra item and use it for next cursor
  let nextCursor: string | null = null;
  if (hasNextPage) {
    const nextItem = users.pop();
    nextCursor = nextItem ? encodeCursor(nextItem.id) : null;
  }
  
  const pagination: CursorPagination = {
    cursor: prevCursor || null,
    nextCursor,
    hasNextPage,
  };
  
  return {
    items: users,
    pagination,
  };
}
```

### Composite Cursor

```typescript
// Service with composite cursor (e.g., Follows table)
async getFollowsPaginated(limit: number = 10, prevCursor?: string) {
  // Decode the composite cursor
  let decodedCursor: FollowsCursor | undefined;
  if(prevCursor){
  try{
    decodedCursor = decodeCompositeCursor<FollowsCursor>(prevCursor);
  }catch{
    throw new BadRequestException('Invalid cursor');
  }

  }
  const decodedCursor = prevCursor 
    ? decodeCompositeCursor<FollowsCursor>(prevCursor) 
    : undefined;
  
  // Fetch limit + 1 to check if there's a next page
  const follows = await this.repo.getFollows(limit + 1, decodedCursor);
  
  // Check if there are more items
  const hasNextPage = follows.length > limit;
  
  // Remove extra item and use it for next cursor
  let nextCursor: string | null = null;
  if (hasNextPage) {
    const nextItem = follows.pop();
    nextCursor = nextItem ? encodeCompositeCursor({
      followerId: nextItem.followerId,
      followedId: nextItem.followedId,
    }) : null;
  }
  
  const pagination: CursorPagination = {
    cursor: prevCursor || null,
    nextCursor,
    hasNextPage,
  };
  
  return {
    items: follows,
    pagination,
  };
}
```
>[!Note]
># Convert to string before encoding and to bigint before using the cursor in the prisma query

## Utility Functions

```typescript
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
```
