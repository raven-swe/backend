import { forwardRef, Module } from '@nestjs/common';
import { ContentParsingService } from './content-parsing.service';
import { UsersModule } from 'src/users/users.module';
import { TrendingModule } from 'src/trending/trending.module';
import { MediaModule } from 'src/media/media.module';

@Module({
  imports: [forwardRef(() => UsersModule), TrendingModule, MediaModule],
  providers: [ContentParsingService],
  exports: [ContentParsingService],
})
export class ContentParsingModule {}
