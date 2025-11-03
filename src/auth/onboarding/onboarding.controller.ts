import { Controller, UseGuards, Get, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';
import { generateUsernames } from 'src/common/utils/generate-validate-usernames.util';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('username-suggestions')
  @UseGuards(JwtAuthGuard)
  async getUsernameSuggestions(@User() user: RequestUser) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: BigInt(user.id) },
      select: {
        email: true,
        profile: {
          select: {
            displayName: true,
          },
        },
      },
    });

    if (!existingUser) {
      throw new UnauthorizedException();
    }

    const displayName = existingUser.profile?.displayName || '';
    const suggestions = await generateUsernames(displayName, existingUser.email, this.prisma, 3);

    return { suggestions };
  }
}
