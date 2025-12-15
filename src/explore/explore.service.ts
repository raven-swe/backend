import { Injectable } from '@nestjs/common';
import { ExploreRepository } from './explore.repository';
import { TweetDto } from 'src/tweets/dtos';
import { UsersRepository } from 'src/users/users.repository';

export interface ForYouCategory {
  category: string;
  tweets: TweetDto[];
}

@Injectable()
export class ExploreService {
  constructor(
    private readonly exploreRepository: ExploreRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async getForYouCategories(userId: bigint): Promise<{
    categories: ForYouCategory[];
  }> {
    const userInterests = await this.usersRepository.getUserInterests(userId);

    if (!userInterests || userInterests.length === 0) {
      return {
        categories: [],
      };
    }

    // Fetch all tweets for all categories in a single query
    const categoryTweetsMap = await this.exploreRepository.getTweetsByCategories(
      userId,
      userInterests,
      5,
    );

    // Convert map to array, filtering out empty categories
    const categories: ForYouCategory[] = [];
    for (const interest of userInterests) {
      const tweets = categoryTweetsMap.get(interest.toLowerCase()) ?? [];
      if (tweets.length > 0) {
        categories.push({
          category: interest.toLowerCase(),
          tweets,
        });
      }
    }

    return {
      categories,
    };
  }

  private mapCategory(category: string): string {
    switch (category) {
      case 'ENTERTAINMENT':
        return 'entertainment';
      case 'SPORTS':
        return 'sports';
      case 'NEWS':
        return 'news';
      default:
        return 'general';
    }
  }

  async getTrendingTabKeywords(): Promise<
    { hashtag: string; tweetsCount: number; category: string }[]
  > {
    const trendingKeywords = await this.exploreRepository.getTrendingKeywords();
    const filteredKeywords = trendingKeywords.map((keyword) => ({
      hashtag: keyword.isHashtag ? '#' + keyword.keyword : keyword.keyword,
      tweetsCount: keyword.count,
      category: this.mapCategory(keyword.topCategory?.category),
    }));

    return filteredKeywords;
  }

  async getEntertainmentKeywords(): Promise<
    { hashtag: string; tweetsCount: number; category: string }[]
  > {
    const trendingKeywords = await this.exploreRepository.getEntertainmentKeywords();
    const filteredKeywords = trendingKeywords.map((keyword) => ({
      hashtag: keyword.isHashtag ? '#' + keyword.keyword : keyword.keyword,
      tweetsCount: keyword.categoryOccurenceCount,
      category: this.mapCategory(keyword.category),
    }));

    return filteredKeywords;
  }

  async getNewsKeywords(): Promise<{ hashtag: string; tweetsCount: number; category: string }[]> {
    const trendingKeywords = await this.exploreRepository.getNewsKeywords();
    const filteredKeywords = trendingKeywords.map((keyword) => ({
      hashtag: keyword.isHashtag ? '#' + keyword.keyword : keyword.keyword,
      tweetsCount: keyword.categoryOccurenceCount,
      category: this.mapCategory(keyword.category),
    }));

    return filteredKeywords;
  }

  async getSportsKeywords(): Promise<{ hashtag: string; tweetsCount: number; category: string }[]> {
    const trendingKeywords = await this.exploreRepository.getSportsKeywords();
    const filteredKeywords = trendingKeywords.map((keyword) => ({
      hashtag: keyword.isHashtag ? '#' + keyword.keyword : keyword.keyword,
      tweetsCount: keyword.categoryOccurenceCount,
      category: this.mapCategory(keyword.category),
    }));

    return filteredKeywords;
  }
}
