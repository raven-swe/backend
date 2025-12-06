import { prepareSearchQuery } from 'src/search/utils/search-query.util';

describe('prepareSearchQuery', () => {
  it('should convert to lowercase and format with :* suffix', () => {
    expect(prepareSearchQuery('TEST QUERY')).toBe('test:* | query:*');
  });

  it('should trim whitespace and split words', () => {
    expect(prepareSearchQuery('   hello world   ')).toBe('hello:* | world:*');
  });

  it('should remove special characters except underscores', () => {
    expect(prepareSearchQuery('hello@world#test')).toBe('hello:* | worldtest:*');
  });

  it('should handle multiple spaces', () => {
    expect(prepareSearchQuery('hello    world')).toBe('hello:* | world:*');
  });

  it('should return empty string for empty input', () => {
    expect(prepareSearchQuery('')).toBe('');
    expect(prepareSearchQuery('   ')).toBe('');
  });

  it('should handle hashtags and mentions', () => {
    expect(prepareSearchQuery('#javascript #react')).toBe('javascript:* | react:*');
    expect(prepareSearchQuery('@username')).toBe('username:*');
  });

  it('should handle numbers', () => {
    expect(prepareSearchQuery('test123')).toBe('test123:*');
  });
});
