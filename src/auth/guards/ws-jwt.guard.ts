import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthService } from '../auth.service';
import { WsUser } from '../interfaces';

const CONNECTION_TIMEOUT = 2 * 60 * 60 * 1000;

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    this.logger.log(`WS Auth attempt - Socket: ${client.id}`);

    const connectionData = client.data as { user?: WsUser; connectedAt?: number };
    if (connectionData.user && connectionData.connectedAt) {
      const connectionAge = Date.now() - connectionData.connectedAt;
      if (connectionAge < CONNECTION_TIMEOUT) {
        this.logger.log(`Reusing authenticated session - User: ${connectionData.user.id}`);
        return true;
      }
      this.logger.warn(`Session expired for user: ${connectionData.user.id}`);
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
      this.logger.warn(`Missing token - Socket: ${client.id}`);
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
      this.logger.warn(`Invalid token - Socket: ${client.id}`);
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

    this.logger.log(`Authentication successful - User: ${userData.id} (${userData.username})`);
    return true;
  }
}
