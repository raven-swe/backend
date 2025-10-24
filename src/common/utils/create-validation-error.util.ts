import { ValidationError } from 'class-validator';

// for any custom error outside the class validator this should be used
// pass proprty as the field name shown in the validation error
// constraints as an object with key as contsraint name, and the value as the error message the client falls back to
// the constraint name should then be mapped in the CONSTRAINT_TO_ERROR_CODE_MAP in http-response.filter.ts

// example usage:
// createValidationError('recaptchaToken', { invalidToken: 'Invalid token' });
// idealy choose the constraint name (invalidToken here) to match an existing one in CONSTRAINT_TO_ERROR_CODE_MAP
// you will probably find one defined already :)
// and throw it in a BadRequestException
// //so throw new BadRequestException(
//         createValidationError('recaptchaToken', {
//           invalidToken: 'Invalid reCAPTCHA token',
//         }),
//       );

export function createValidationError(
  property: string,
  constraints: Record<string, string>,
): { message: ValidationError[] } {
  return {
    message: validationErrorHelper(property, constraints),
  };
}

function validationErrorHelper(
  property: string,
  constraints: Record<string, string>,
): ValidationError[] {
  return [
    {
      property,
      constraints,
      children: [],
    },
  ];
}
