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
import { MediaModule } from 'src/media/media.module';
import { MessageNotificationsListeners } from './messages/messages.listeners';
import { BullModule } from '@nestjs/bullmq';
import { MessagesPushProcessor } from './messages/messages-push.processor';
import { FirebaseModule } from 'src/firebase/firebase.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'messages-push' }),
    UsersModule,
    PrismaModule,
    AuthModule,
    MediaModule,
    forwardRef(() => SseModule),
    FirebaseModule,
  ],
  controllers: [ConversationsController, MessagesController],
  providers: [
    ConversationsService,
    ConversationsRepository,
    MessagesService,
    MessagesRepository,
    MessageNotificationsListeners,
    MessagesPushProcessor,
    DmGateway,
  ],
  exports: [ConversationsService, ConversationsRepository],
})
export class ConversationsModule {}
