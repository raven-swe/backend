import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
  imports: [UsersModule],
})
export class SearchModule {}
