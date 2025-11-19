import { BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ParseJsonBodyPipe } from './parse-json-body.pipe';
import { createValidationError } from 'src/common/utils/create-validation-error.util';

// Mock dependencies
jest.mock('class-transformer');
jest.mock('class-validator');
jest.mock('src/common/utils/create-validation-error.util');

describe('ParseJsonBodyPipe', () => {
  let pipe: ParseJsonBodyPipe;
  const mockPlainToInstance = plainToInstance as jest.MockedFunction<typeof plainToInstance>;
  const mockValidate = validate as jest.MockedFunction<typeof validate>;
  const mockCreateValidationError = createValidationError as jest.MockedFunction<
    typeof createValidationError
  >;

  beforeEach(() => {
    pipe = new ParseJsonBodyPipe();
    jest.clearAllMocks();

    // Default mock implementation
    mockCreateValidationError.mockImplementation((field, errors) => ({
      field,
      errors,
      message: [],
    }));
  });

  describe('transform - non-string values', () => {
    it('should return value as-is when value is already an object', async () => {
      const value = { name: 'test', age: 25 };
      const metadata: ArgumentMetadata = { type: 'body' };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(value);
    });

    it('should return value as-is when value is a number', async () => {
      const value = 42;
      const metadata: ArgumentMetadata = { type: 'body' };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(value);
    });

    it('should return value as-is when value is null', async () => {
      const value = null;
      const metadata: ArgumentMetadata = { type: 'body' };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(value);
    });
  });

  describe('transform - JSON parsing', () => {
    it('should parse valid JSON string', async () => {
      const value = '{"name":"test","age":25}';
      const metadata: ArgumentMetadata = { type: 'body' };

      const result = await pipe.transform(value, metadata);

      expect(result).toEqual({ name: 'test', age: 25 });
    });

    it('should throw BadRequestException for invalid JSON', async () => {
      const value = '{invalid json}';
      const metadata: ArgumentMetadata = { type: 'body' };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);

      expect(mockCreateValidationError).toHaveBeenCalledWith('data', {
        invalidJson: 'The "data" field must be a valid JSON string.',
      });
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should throw BadRequestException when parsed value is not an object with metatype', async () => {
      const value = '"just a string"';
      class TestDto {}
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: TestDto,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);

      expect(mockCreateValidationError).toHaveBeenCalledWith('data', {
        invalidData: 'The "data" field must be a valid object.',
      });
    });

    it('should throw BadRequestException when parsed value is null with metatype', async () => {
      const value = 'null';
      class TestDto {}
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: TestDto,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);

      expect(mockCreateValidationError).toHaveBeenCalledWith('data', {
        invalidData: 'The "data" field must be a valid object.',
      });
    });
  });

  describe('transform - DTO validation', () => {
    class TestDto {
      name?: string;
      age?: number;
    }

    it('should validate and return DTO instance when validation passes', async () => {
      const value = '{"name":"test","age":25}';
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: TestDto,
      };
      const dtoInstance = { name: 'test', age: 25 };

      mockPlainToInstance.mockReturnValue(dtoInstance);
      mockValidate.mockResolvedValue([]);

      const result = await pipe.transform(value, metadata);

      expect(mockPlainToInstance).toHaveBeenCalledWith(TestDto, { name: 'test', age: 25 });
      expect(mockValidate).toHaveBeenCalledWith(dtoInstance, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      expect(result).toBe(dtoInstance);
    });

    it('should throw BadRequestException when validation fails', async () => {
      const value = '{"name":"test"}';
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: TestDto,
      };
      const dtoInstance = { name: 'test' };
      const validationErrors = [
        {
          property: 'age',
          constraints: {
            isNumber: 'age must be a number',
          },
        },
      ];

      mockPlainToInstance.mockReturnValue(dtoInstance);
      mockValidate.mockResolvedValue(validationErrors as never);

      await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);

      expect(mockCreateValidationError).toHaveBeenCalledWith('age', {
        validationFailed: 'age must be a number',
      });
    });

    it('should pass when at least one property has a value', async () => {
      const value = '{"name":"test"}';
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: TestDto,
      };
      const dtoInstance = { name: 'test', age: undefined };

      mockPlainToInstance.mockReturnValue(dtoInstance);
      mockValidate.mockResolvedValue([]);

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(dtoInstance);
    });
  });

  describe('transform - metatype validation', () => {
    it('should skip DTO transformation for String metatype', async () => {
      const value = '{"name":"test"}';
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: String,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toEqual({ name: 'test' });
      expect(mockPlainToInstance).not.toHaveBeenCalled();
      expect(mockValidate).not.toHaveBeenCalled();
    });

    it('should skip DTO transformation for Number metatype', async () => {
      const value = '{"count":42}';
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Number,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toEqual({ count: 42 });
      expect(mockPlainToInstance).not.toHaveBeenCalled();
    });

    it('should skip DTO transformation for Boolean metatype', async () => {
      const value = '{"active":true}';
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Boolean,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toEqual({ active: true });
      expect(mockPlainToInstance).not.toHaveBeenCalled();
    });

    it('should process custom DTO classes', async () => {
      class CustomDto {
        field?: string;
      }
      const value = '{"field":"value"}';
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: CustomDto,
      };
      const dtoInstance = { field: 'value' };

      mockPlainToInstance.mockReturnValue(dtoInstance);
      mockValidate.mockResolvedValue([]);

      const result = await pipe.transform(value, metadata);

      expect(mockPlainToInstance).toHaveBeenCalledWith(CustomDto, { field: 'value' });
      expect(result).toBe(dtoInstance);
    });
  });
});
