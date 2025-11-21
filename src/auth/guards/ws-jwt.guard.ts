import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthService } from '../auth.service';
import { WsUser } from '../interfaces';

const CONNECTION_TIMEOUT = 2 * 60 * 60 * 1000;

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();

    const connectionData = client.data as { user?: WsUser; connectedAt?: number };
    if (connectionData.user && connectionData.connectedAt) {
      const connectionAge = Date.now() - connectionData.connectedAt;
      if (connectionAge < CONNECTION_TIMEOUT) {
        return true;
      }
      client.emit('error', {
        type: 'authentication_error',
        code: 'SESSION_EXPIRED',
        message: 'Connection session expired after 2 hours. Please reconnect.',
      });
      client.disconnect();
      return false;
    }

    const token = client.handshake.query.token as string;

    if (!token) {
      client.emit('error', {
        type: 'authentication_error',
        code: 'MISSING_TOKEN',
        message: 'Authentication token is required.',
      });
      client.disconnect();
      return false;
    }

    const user = await this.authService.validateUserToken(token);

    if (!user) {
      client.emit('error', {
        type: 'authentication_error',
        code: 'INVALID_TOKEN',
        message: 'Authentication failed. Invalid or expired token.',
      });
      client.disconnect();
      return false;
    }

    const userData: WsUser = {
      id: user.id.toString(),
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
    connectionData.user = userData;
    connectionData.connectedAt = Date.now();

    return true;
  }
}
