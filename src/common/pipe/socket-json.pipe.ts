import { PipeTransform, Injectable } from '@nestjs/common';

@Injectable()
export class SocketJsonPipe implements PipeTransform {
  transform(value: any) {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
}
