import { Module, forwardRef } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationsRepository } from './conversations.repository';
import { UsersModule } from 'src/users/users.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MessagesController } from './messages/messages.controller';
import { MessagesService } from './messages/messages.services';
import { MessagesRepository } from './messages/messages.repository';
import { AuthModule } from 'src/auth/auth.module';
import { DmGateway } from './gateways/dm.gateway';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [UsersModule, PrismaModule, AuthModule, forwardRef(() => SseModule)],
  controllers: [ConversationsController, MessagesController],
  providers: [
    ConversationsService,
    ConversationsRepository,
    MessagesService,
    MessagesRepository,
    DmGateway,
  ],
  exports: [ConversationsService, ConversationsRepository],
})
export class ConversationsModule {}
