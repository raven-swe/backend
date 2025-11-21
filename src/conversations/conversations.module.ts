import { Module } from '@nestjs/common';
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
import { EventPublisherService } from './event-publisher.service';
import { SseController } from './sse.controller';
import { SseService } from './sse.service';

@Module({
  imports: [UsersModule, PrismaModule, AuthModule],
  controllers: [ConversationsController, MessagesController, SseController],
  providers: [
    ConversationsService,
    ConversationsRepository,
    MessagesService,
    MessagesRepository,
    DmGateway,
    EventPublisherService,
    SseService,
  ],
})
export class ConversationsModule {}
