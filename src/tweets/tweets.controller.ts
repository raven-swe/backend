import { Controller, UseGuards } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('tweets')
@UseGuards(JwtAuthGuard)
export class TweetsController {
  constructor(private readonly tweetsService: TweetsService) {}

  // --------------------------------------
}
