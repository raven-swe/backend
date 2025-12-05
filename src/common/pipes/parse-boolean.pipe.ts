import { Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseBooleanPipe implements PipeTransform {
  transform(value: boolean | string) {
    if (typeof value === 'boolean') {
      return value;
    }

    return value;
  }
}
