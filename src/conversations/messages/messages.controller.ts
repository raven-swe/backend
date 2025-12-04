import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ConversationIdParamDto, ConversationMessageParamDto } from '../dtos';
import type { RequestUser } from 'src/common/interfaces';
import { User } from 'src/auth/decorators';
import { JwtAuthGuard } from 'src/auth/guards';
import { PaginationQueryDto } from 'src/common/dtos';
import { MessagesService } from './messages.services';

@Controller('/conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMessagesInConversation(
    @User() user: RequestUser,
    @Param() params: ConversationIdParamDto,
    @Query() pagination: PaginationQueryDto,
  ) {
    const userId = BigInt(user.id);
    const conversationIdNum = BigInt(params.conversationId);
    const { limit, cursor } = pagination;

    return this.messagesService.getMessagesInConversation(userId, conversationIdNum, limit, cursor);
  }

  @Delete('/:messageId')
  @UseGuards(JwtAuthGuard)
  async deleteConversationMessage(
    @User() user: RequestUser,
    @Param() params: ConversationMessageParamDto,
  ) {
    const userId = BigInt(user.id);
    const conversationIdNum = BigInt(params.conversationId);
    const messageIdNum = BigInt(params.messageId);

    await this.messagesService.deleteConversationMessage(userId, conversationIdNum, messageIdNum);

    return {
      message: 'Message deleted successfully',
    };
  }
}
