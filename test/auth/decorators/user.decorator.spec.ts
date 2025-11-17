import { ExecutionContext } from '@nestjs/common';
import { getUserFromContext } from 'src/auth/decorators';

describe('User Decorator Logic', () => {
  it('should extract the user from the execution context', () => {
    const mockUser = { id: '123', username: 'test' };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: mockUser,
        }),
      }),
    } as unknown as ExecutionContext;

    const result = getUserFromContext(null, mockContext);

    expect(result).toBe(mockUser);
  });
});
