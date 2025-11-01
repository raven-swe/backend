import { Controller, Get, HttpCode, UseGuards } from '@nestjs/common';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';
import { TweetsService } from './tweets.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('tweets')
@UseGuards(JwtAuthGuard)
export class TweetsController {
  constructor(private readonly tweetsService: TweetsService) {}

  @Get('timeline')
  @HttpCode(200)
  // --- MODIFIED: Removed @Query('cursor') ---
  async getTimeline(@User() user: RequestUser) {
    const userId = BigInt(user.id);
    const timelineTweets = await this.tweetsService.getTimeline(userId);

    return {
      message: 'Full timeline retrieved successfully',
      data: timelineTweets,
    };
  }
  // --------------------------------------
}
