import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

interface WsExceptionError {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch(WsException)
export class WsValidationExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsValidationExceptionFilter.name);

  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const data: { clientMessageId?: string; conversationId?: string; messageId?: string } = host
      .switchToWs()
      .getData();

    const error = exception.getError();
    let message: string;
    let validationDetails: string[] = [];

    if (typeof error === 'string') {
      message = error;
    } else if (typeof error === 'object' && error !== null) {
      const errorObj = error as WsExceptionError;
      if (Array.isArray(errorObj.message)) {
        validationDetails = errorObj.message;
        message = errorObj.message.join(', ');
      } else if (typeof errorObj.message === 'string') {
        message = errorObj.message;
        validationDetails = [errorObj.message];
      } else {
        message = 'Validation failed';
      }
    } else {
      message = 'Validation failed';
    }

    this.logger.log(
      JSON.stringify({
        type: 'VALIDATION_ERROR',
        validationErrors: validationDetails,
        failedData: {
          conversationId: data?.conversationId,
          messageId: data?.messageId,
          clientMessageId: data?.clientMessageId,
        },
        timestamp: new Date().toISOString(),
      }),
    );

    client.emit('error', {
      type: 'error',
      code: 'VALIDATION_ERROR',
      message,
      ...(data?.clientMessageId && { clientMessageId: data.clientMessageId }),
    });
  }
}
