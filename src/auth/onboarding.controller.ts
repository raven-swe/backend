import { Controller, UseGuards, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { JwtAuthGuard } from './guards/';
import { User } from 'src/auth/decorators';
import type { RequestUser } from '../common/interfaces';
import { generateUsernames } from 'src/common/utils';
import { UsersRepository } from 'src/users/users.repository';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/users/constants';
import { ONBOARDING_CONSTANTS } from './constants';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly usersRepository: UsersRepository) {}

  @Get('username-suggestions')
  @UseGuards(JwtAuthGuard)
  async getUsernameSuggestions(@User() user: RequestUser, @Query('typed') typed?: string) {
    const existingUser = await this.usersRepository.getUserEmailAndDisplayName(BigInt(user.id));

    if (!existingUser) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const displayName = existingUser.profile?.displayName || '';
    const suggestions = await generateUsernames(
      this.usersRepository,
      displayName,
      existingUser.email,
      typed,
      ONBOARDING_CONSTANTS.USERNAME_SUGGESTIONS_COUNT,
      false,
    );

    return { suggestions };
  }

  @Get('follow-suggestions')
  @UseGuards(JwtAuthGuard)
  async getFollowSuggestions(@User() user: RequestUser) {
    const userId = BigInt(user.id);
    const suggestions = await this.usersRepository.getOnboardingFollowSuggestions(
      userId,
      ONBOARDING_CONSTANTS.FOLLOW_SUGGESTIONS_COUNT,
    );
    return { suggestions };
  }
}
