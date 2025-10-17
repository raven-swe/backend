import { Module } from '@nestjs/common';
import { RefreshTokensService } from './refresh-tokens.service';

@Module({
  providers: [RefreshTokensService],
})
export class RefreshTokensModule {}
