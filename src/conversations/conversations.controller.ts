import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from 'src/auth/decorators';
import { JwtAuthGuard } from 'src/auth/guards';
import type { RequestUser } from 'src/common/interfaces';
import { ConversationsService } from './conversations.service';
import { PaginationQueryDto } from 'src/common/dtos';
import { ConversationIdParamDto, UsernameParamDto } from './dtos';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserConversations(@User() user: RequestUser, @Query() pagination: PaginationQueryDto) {
    const userId = BigInt(user.id);

    const { limit, cursor } = pagination;
    return await this.conversationsService.getUserConversations(userId, limit, cursor);
  }

  @Post('with/:username')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async createOrFindConversation(@User() user: RequestUser, @Param() params: UsernameParamDto) {
    const userId = BigInt(user.id);
    return await this.conversationsService.createOrFindConversation(userId, params.username);
  }

  @Get('/:conversationId/messages')
  @UseGuards(JwtAuthGuard)
  async getMessagesInConversation(
    @User() user: RequestUser,
    @Param() params: ConversationIdParamDto,
    @Query() pagination: PaginationQueryDto,
  ) {
    const userId = BigInt(user.id);
    const conversationIdNum = BigInt(params.conversationId);
    const { limit, cursor } = pagination;

    return await this.conversationsService.getMessagesInConversation(
      userId,
      conversationIdNum,
      limit,
      cursor,
    );
  }
}
