import { Logger, Module } from '@nestjs/common';
import { RefreshTokensService } from './refresh-tokens.service';
import { RefreshTokensRepository } from './refresh-tokens.repository';

@Module({
  providers: [RefreshTokensService, RefreshTokensRepository, Logger],
  exports: [RefreshTokensService],
})
export class RefreshTokensModule {}
