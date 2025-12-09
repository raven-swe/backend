import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { UsersModule } from 'src/users/users.module';
import { TweetsModule } from 'src/tweets/tweets.module';
import { TrendingModule } from 'src/trending/trending.module';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
  imports: [UsersModule, TweetsModule, TrendingModule],
})
export class SearchModule {}
