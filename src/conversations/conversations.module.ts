import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationsRepository } from './conversations.repository';
import { UsersModule } from 'src/users/users.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MessagesController } from './messages/messages.controller';
import { MessagesService } from './messages/messages.services';
import { MessagesRepository } from './messages/messages.repository';

@Module({
  imports: [UsersModule, PrismaModule],
  controllers: [ConversationsController, MessagesController],
  providers: [ConversationsService, ConversationsRepository, MessagesService, MessagesRepository],
})
export class ConversationsModule {}
