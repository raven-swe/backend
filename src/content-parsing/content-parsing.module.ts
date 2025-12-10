import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContentParsingService } from './content-parsing.service';
import { UsersModule } from 'src/users/users.module';
import { TrendingModule } from 'src/trending/trending.module';
import { MediaModule } from 'src/media/media.module';

@Module({
  imports: [forwardRef(() => UsersModule), TrendingModule, MediaModule, ConfigModule],
  providers: [ContentParsingService],
  exports: [ContentParsingService],
})
export class ContentParsingModule {}
