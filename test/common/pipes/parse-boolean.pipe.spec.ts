import { ParseBooleanPipe } from 'src/common/pipes/parse-boolean.pipe';

describe('ParseBooleanPipe', () => {
  let pipe: ParseBooleanPipe;

  beforeEach(() => {
    pipe = new ParseBooleanPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  describe('transform', () => {
    it('should return true when value is boolean true', () => {
      const result = pipe.transform(true);
      expect(result).toBe(true);
    });

    it('should return false when value is boolean false', () => {
      const result = pipe.transform(false);
      expect(result).toBe(false);
    });

    it('should return string when value is a string', () => {
      const result = pipe.transform('true');
      expect(result).toBe('true');
      expect(typeof result).toBe('string');
    });

    it('should return empty string when value is empty string', () => {
      const result = pipe.transform('');
      expect(result).toBe('');
    });

    it('should return any string value as-is', () => {
      const testValues = ['false', 'True', 'FALSE', 'yes', 'no', '0', '1'];
      testValues.forEach((value) => {
        const result = pipe.transform(value);
        expect(result).toBe(value);
      });
    });
  });
});
