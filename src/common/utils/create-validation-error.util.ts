import { ValidationError } from 'class-validator';

// use this when you need the unified validation response when it's not returned by a class-validator

// pass property as the FIELD NAME SHOWN IN THE VALIDATION ERROR
// constraints as an object with key as contsraint name, and the VALUE AS THE ERROR MESSAGE the client falls back to
// the constraint name should then be mapped in the CONSTRAINT_TO_ERROR_CODE_MAP in http-response.filter.ts
// YOU WILL PROBABLY FIND YOURS THERE ALREADY, those are very generic, like invalidToken for example

// example usage:
// createValidationError('recaptchaToken', { invalidToken: 'Invalid token' });
// idealy choose the constraint name (invalidToken here) to match an existing one in CONSTRAINT_TO_ERROR_CODE_MAP
// you will probably find one defined already :)
// and throw it in a BadRequestException
// //so throw new BadRequestException(
//         createValidationError('recaptchaToken', {
//           invalidToken: 'The provided reCAPTCHA token is invalid or expired',
//         }),
//       );

//this returns
// {
//   "success": false,
//   "error": {
//     "code": "VALIDATION_ERROR",
//     "message": "Validation failed",
//     "errors": [
//       {
//         "field": "recaptchaToken",
//         "code": "INVALID_TOKEN",
//         "message": "The provided reCAPTCHA token is invalid or expired"
//       }
//     ]
//   }
// }

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
    },
  ];
}
