import { Injectable } from '@nestjs/common';
import { ExploreRepository } from './explore.repository';

@Injectable()
export class ExploreService {
  constructor(private readonly exploreRepository: ExploreRepository) {}

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

  async getTrendingTabKeywords() {
    const trendingKeywords = await this.exploreRepository.getTrendingKeywords();
    const filteredKeywords = trendingKeywords.map((keyword) => ({
      hashtag: keyword.keyword,
      tweetsCount: keyword.count,
      category: this.mapCategory(keyword.topCategory.category),
    }));

    return filteredKeywords;
  }

  async getEntertainmentKeywords() {
    const trendingKeywords = await this.exploreRepository.getEntertainmentKeywords();
    const filteredKeywords = trendingKeywords.map((keyword) => ({
      hashtag: keyword.keyword,
      tweetsCount: keyword.categoryOccurenceCount,
      category: this.mapCategory(keyword.category),
    }));

    return filteredKeywords;
  }

  async getNewsKeywords() {
    const trendingKeywords = await this.exploreRepository.getNewsKeywords();
    const filteredKeywords = trendingKeywords.map((keyword) => ({
      hashtag: keyword.keyword,
      tweetsCount: keyword.categoryOccurenceCount,
      category: this.mapCategory(keyword.category),
    }));

    return filteredKeywords;
  }

  async getSportsKeywords() {
    const trendingKeywords = await this.exploreRepository.getSportsKeywords();
    const filteredKeywords = trendingKeywords.map((keyword) => ({
      hashtag: keyword.keyword,
      tweetsCount: keyword.categoryOccurenceCount,
      category: this.mapCategory(keyword.category),
    }));

    return filteredKeywords;
  }
}
