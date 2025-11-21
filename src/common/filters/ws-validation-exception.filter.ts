import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

interface WsExceptionError {
  message?: string | string[];
}

@Catch(WsException)
export class WsValidationExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const data: { clientMessageId?: string } = host.switchToWs().getData();

    const error = exception.getError();
    let message: string;

    if (typeof error === 'string') {
      message = error;
    } else if (typeof error === 'object' && error !== null) {
      const errorObj = error as WsExceptionError;
      if (Array.isArray(errorObj.message)) {
        message = errorObj.message.join(', ');
      } else if (typeof errorObj.message === 'string') {
        message = errorObj.message;
      } else {
        message = 'Validation failed';
      }
    } else {
      message = 'Validation failed';
    }

    client.emit('error', {
      type: 'error',
      code: 'VALIDATION_ERROR',
      message,
      clientMessageId: data?.clientMessageId,
    });
  }
}
