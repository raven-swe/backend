import { BadRequestException } from '@nestjs/common';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { createValidationError } from './create-validation-error.util';

const PURE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T.+$/;

/**
 * Global transformer for date fields in DTOs.
 * Accepts ISO date strings (YYYY-MM-DD or full ISO datetime) and transforms them to Date objects.
 * Refuses invalid formats and forces UTC for pure dates to avoid timezone shifts.
 */
export function IsoDate() {
  // Return a function that applies multiple decorators
  return function (target: any, propertyKey: string) {
    Type(() => String)(target, propertyKey);

    Transform(
      ({ value, key }: TransformFnParams) => {
        if (value === null || value === undefined || value === '') {
          return undefined;
        }
        const str = String(value).trim();

        // Acceptable formats
        const isPureDate = PURE_DATE.test(str);
        const isIsoWithTime = ISO_DATETIME.test(str);

        if (!isPureDate && !isIsoWithTime) {
          throw new BadRequestException(
            createValidationError(key, {
              invalidFormat: `Invalid date format. Expected ISO date (YYYY-MM-DD or ISO 8601 datetime).`,
            }),
          );
        }

        let date: Date;
        if (isPureDate) {
          // Force UTC to avoid timezone shifts
          const [year, month, day] = str.split('-').map(Number);
          date = new Date(Date.UTC(year, month - 1, day));

          // Strict validation: ensure the date didn't roll over
          if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
          ) {
            throw new BadRequestException(
              createValidationError(key, {
                invalidValue: `Invalid date value. The date "${str}" does not exist.`,
              }),
            );
          }
        } else {
          date = new Date(str);

          const datePart = str.split('T')[0];
          const [year, month, day] = datePart.split('-').map(Number);

          const testDate = new Date(Date.UTC(year, month - 1, day));

          if (
            testDate.getUTCFullYear() !== year ||
            testDate.getUTCMonth() !== month - 1 ||
            testDate.getUTCDate() !== day
          ) {
            throw new BadRequestException(
              createValidationError(key, {
                invalidValue: `Invalid date value. The date "${datePart}" does not exist.`,
              }),
            );
          }
        }

        if (isNaN(date.getTime())) {
          throw new BadRequestException(
            createValidationError(key, {
              invalidValue: `Invalid date value.`,
            }),
          );
        }

        return date;
      },
      { toClassOnly: true },
    )(target, propertyKey);
  };
}
