import { maskEmail } from './mask-email.util';

describe('maskEmail', () => {
  describe('invalid inputs', () => {
    it('should return fallback mask for null', () => {
      expect(maskEmail(null)).toBe('*******');
    });

    it('should return fallback mask for undefined', () => {
      expect(maskEmail(undefined)).toBe('*******');
    });

    it('should return fallback mask for empty string', () => {
      expect(maskEmail('')).toBe('*******');
    });

    it('should return fallback mask when no @ symbol', () => {
      expect(maskEmail('invalidemail')).toBe('*******');
    });

    it('should return fallback mask when @ is first character', () => {
      expect(maskEmail('@example.com')).toBe('*******');
    });

    it('should return fallback mask when no domain after @', () => {
      expect(maskEmail('user@')).toBe('*******');
    });

    it('should mask local part and return fallback for invalid domain (no dot)', () => {
      expect(maskEmail('user@domain')).toBe('use*@*******');
    });

    it('should mask local part and return fallback for empty domain parts', () => {
      expect(maskEmail('user@.com')).toBe('use*@*******');
    });

    it('should mask local part and return fallback for consecutive dots', () => {
      expect(maskEmail('user@domain..com')).toBe('use*@*******');
    });
  });

  describe('valid emails - local part masking', () => {
    it('should mask 1-character local part', () => {
      expect(maskEmail('a@example.com')).toBe('*@e******.c**');
    });

    it('should mask 2-character local part', () => {
      expect(maskEmail('ab@example.com')).toBe('a*@e******.c**');
    });

    it('should mask 3-character local part', () => {
      expect(maskEmail('abc@example.com')).toBe('ab*@e******.c**');
    });

    it('should mask 4+-character local part', () => {
      expect(maskEmail('john@example.com')).toBe('joh*@e******.c**');
    });

    it('should mask long local part', () => {
      expect(maskEmail('verylongemail@example.com')).toBe('ver**********@e******.c**');
    });
  });

  describe('valid emails - domain part masking', () => {
    it('should mask single-character domain parts', () => {
      expect(maskEmail('user@a.b.c')).toBe('use*@*.*.*');
    });

    it('should mask multi-character domain parts', () => {
      expect(maskEmail('user@mail.example.com')).toBe('use*@m***.e******.c**');
    });

    it('should handle multiple subdomains', () => {
      expect(maskEmail('user@mail.sub.example.com')).toBe('use*@m***.s**.e******.c**');
    });

    it('should mask two-part domain correctly', () => {
      expect(maskEmail('test@domain.co')).toBe('tes*@d*****.c*');
    });
  });

  describe('complex scenarios', () => {
    it('should handle email with dots in local part', () => {
      expect(maskEmail('first.last@example.com')).toBe('fir*******@e******.c**');
    });

    it('should handle email with plus sign in local part', () => {
      expect(maskEmail('user+tag@example.com')).toBe('use*****@e******.c**');
    });

    it('should handle email with numbers', () => {
      expect(maskEmail('user123@example456.com')).toBe('use****@e*********.c**');
    });

    it('should handle short domain extension', () => {
      expect(maskEmail('user@example.co')).toBe('use*@e******.c*');
    });

    it('should handle long domain extension', () => {
      expect(maskEmail('user@example.museum')).toBe('use*@e******.m*****');
    });
  });
});
