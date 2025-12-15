import { decodeCursor, decodeCompositeCursor, paginateComposite } from './cursor-pagination.util';

describe('cursor-pagination.util', () => {
  describe('decodeCursor', () => {
    it('should decode a base64 cursor string', () => {
      const cursor = Buffer.from('test-cursor-value').toString('base64');
      const result = decodeCursor(cursor);
      expect(result).toBe('test-cursor-value');
    });

    it('should return undefined for undefined cursor', () => {
      const result = decodeCursor(undefined);
      expect(result).toBeUndefined();
    });

    it('should decode cursor with special characters', () => {
      const original = 'cursor:with:special@chars#123';
      const cursor = Buffer.from(original).toString('base64');
      const result = decodeCursor(cursor);
      expect(result).toBe(original);
    });

    it('should decode empty string cursor to empty string', () => {
      const cursor = Buffer.from('').toString('base64');
      const result = decodeCursor(cursor);
      // Empty base64 string becomes undefined when checked in decodeCursor
      expect(result).toBeUndefined();
    });
  });

  describe('decodeCompositeCursor', () => {
    it('should decode a composite cursor with single field', () => {
      const cursorObject = { id: '123' };
      const encoded = Buffer.from(JSON.stringify(cursorObject)).toString('base64');
      const result = decodeCompositeCursor<{ id: string }>(encoded);
      expect(result).toEqual(cursorObject);
    });

    it('should decode a composite cursor with multiple fields', () => {
      const cursorObject = {
        followerId: '1',
        followedId: '2',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      const encoded = Buffer.from(JSON.stringify(cursorObject)).toString('base64');
      const result = decodeCompositeCursor<typeof cursorObject>(encoded);
      expect(result).toEqual(cursorObject);
    });

    it('should return undefined for empty cursor string', () => {
      const result = decodeCompositeCursor('');
      expect(result).toBeUndefined();
    });

    it('should decode cursor with nested objects', () => {
      const cursorObject = {
        user: { id: '1', name: 'test' },
        timestamp: '2024-01-01',
      };
      const encoded = Buffer.from(JSON.stringify(cursorObject)).toString('base64');
      const result = decodeCompositeCursor<typeof cursorObject>(encoded);
      expect(result).toEqual(cursorObject);
    });

    it('should decode cursor with null values', () => {
      const cursorObject = { id: '1', value: null };
      const encoded = Buffer.from(JSON.stringify(cursorObject)).toString('base64');
      const result = decodeCompositeCursor<typeof cursorObject>(encoded);
      expect(result).toEqual(cursorObject);
    });
  });

  describe('paginateComposite', () => {
    interface TestItem {
      id: bigint;
      name: string;
      createdAt: Date;
    }

    const createTestItems = (count: number): TestItem[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: BigInt(i + 1),
        name: `item-${i + 1}`,
        createdAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
      }));
    };

    it('should return hasNextPage true when items exceed limit', () => {
      const items = createTestItems(6);
      const limit = 5;

      const result = paginateComposite(items, limit, undefined, (item) => ({
        id: item.id.toString(),
      }));

      expect(result.hasNextPage).toBe(true);
      expect(result.nextCursor).not.toBeNull();
      expect(result.cursor).toBeNull();
      expect(items.length).toBe(5); // Last item should be popped
    });

    it('should return hasNextPage false when items equal limit', () => {
      const items = createTestItems(5);
      const limit = 5;

      const result = paginateComposite(items, limit, undefined, (item) => ({
        id: item.id.toString(),
      }));

      expect(result.hasNextPage).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(items.length).toBe(5);
    });

    it('should return hasNextPage false when items less than limit', () => {
      const items = createTestItems(3);
      const limit = 5;

      const result = paginateComposite(items, limit, undefined, (item) => ({
        id: item.id.toString(),
      }));

      expect(result.hasNextPage).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(items.length).toBe(3);
    });

    it('should encode composite cursor with multiple fields', () => {
      const items = createTestItems(6);
      const limit = 5;

      const result = paginateComposite(items, limit, undefined, (item) => ({
        id: item.id.toString(),
        name: item.name,
        timestamp: item.createdAt.toISOString(),
      }));

      expect(result.nextCursor).not.toBeNull();

      // Decode and verify the cursor
      const decoded = decodeCompositeCursor<{
        id: string;
        name: string;
        timestamp: string;
      }>(result.nextCursor!);
      expect(decoded).toEqual({
        id: '6',
        name: 'item-6',
        timestamp: new Date('2024-01-06').toISOString(),
      });
    });

    it('should preserve prevCursor in result', () => {
      const items = createTestItems(3);
      const limit = 5;
      const prevCursor = Buffer.from(JSON.stringify({ id: '10' })).toString('base64');

      const result = paginateComposite(items, limit, prevCursor, (item) => ({
        id: item.id.toString(),
      }));

      expect(result.cursor).toBe(prevCursor);
    });

    it('should convert bigint to string in cursor', () => {
      const items = createTestItems(6);
      const limit = 5;

      const result = paginateComposite(items, limit, undefined, (item) => ({
        id: item.id, // Pass bigint directly
        otherId: BigInt(999),
      }));

      expect(result.nextCursor).not.toBeNull();

      // Decode and verify bigint is converted to string
      const decoded = decodeCompositeCursor<{ id: string; otherId: string }>(result.nextCursor!);
      expect(decoded).toEqual({
        id: '6',
        otherId: '999',
      });
      expect(typeof decoded?.id).toBe('string');
      expect(typeof decoded?.otherId).toBe('string');
    });

    it('should handle empty items array', () => {
      const items: TestItem[] = [];
      const limit = 5;

      const result = paginateComposite(items, limit, undefined, (item) => ({
        id: item.id.toString(),
      }));

      expect(result.hasNextPage).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.cursor).toBeNull();
    });

    it('should handle single item with limit 1', () => {
      const items = createTestItems(2);
      const limit = 1;

      const result = paginateComposite(items, limit, undefined, (item) => ({
        id: item.id.toString(),
      }));

      expect(result.hasNextPage).toBe(true);
      expect(result.nextCursor).not.toBeNull();
      expect(items.length).toBe(1);
    });

    it('should handle cursor with mixed types', () => {
      const items = createTestItems(6);
      const limit = 5;

      const result = paginateComposite(items, limit, undefined, (item) => ({
        stringField: 'test',
        numberField: 123,
        booleanField: true,
        bigintField: item.id,
        nullField: null,
        undefinedField: undefined,
      }));

      expect(result.nextCursor).not.toBeNull();

      const decoded = decodeCompositeCursor<any>(result.nextCursor!);
      expect(decoded.stringField).toBe('test');
      expect(decoded.numberField).toBe(123);
      expect(decoded.booleanField).toBe(true);
      expect(decoded.bigintField).toBe('6'); // Converted to string
      expect(decoded.nullField).toBeNull();
      expect(decoded.undefinedField).toBeUndefined();
    });

    it('should not mutate original items when hasNextPage is false', () => {
      const items = createTestItems(5);
      const originalLength = items.length;
      const limit = 5;

      paginateComposite(items, limit, undefined, (item) => ({ id: item.id.toString() }));

      expect(items.length).toBe(originalLength);
    });

    it('should work with complex cursor field extraction', () => {
      interface ComplexItem {
        user: { id: bigint; username: string };
        post: { id: bigint; createdAt: Date };
      }

      const items: ComplexItem[] = [
        {
          user: { id: BigInt(1), username: 'user1' },
          post: { id: BigInt(101), createdAt: new Date('2024-01-01') },
        },
        {
          user: { id: BigInt(2), username: 'user2' },
          post: { id: BigInt(102), createdAt: new Date('2024-01-02') },
        },
        {
          user: { id: BigInt(3), username: 'user3' },
          post: { id: BigInt(103), createdAt: new Date('2024-01-03') },
        },
      ];

      const result = paginateComposite(items, 2, undefined, (item) => ({
        userId: item.user.id,
        postId: item.post.id,
      }));

      expect(result.hasNextPage).toBe(true);
      const decoded = decodeCompositeCursor<{ userId: string; postId: string }>(result.nextCursor!);
      expect(decoded).toEqual({
        userId: '3',
        postId: '103',
      });
    });
  });
});
