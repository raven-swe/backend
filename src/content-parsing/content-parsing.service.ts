import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ParsedContent } from 'src/common/interfaces/parsed-content.interface';
import { TrendingService } from 'src/trending/trending.service';
import { PlainHashtag, PlainMention } from 'src/tweets/interfaces';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class ContentParsingService {
  private readonly logger = new Logger(ContentParsingService.name);

  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly trendingService: TrendingService,
  ) {}

  /**
   *
   * @param content The text to parse (tweet, bio or message)
   * @param tx a transaction client (this is called on save for either tweets, bio or messages, so a transaction is expected)
   * @returns Mentions and Hashtags with their IDs from the database, ready to be saved and linked to the content
   */
  async parseContentAndValidate(
    content: string,
    tx: Prisma.TransactionClient,
  ): Promise<{
    mentions: (PlainMention & {
      userId: bigint;
    })[];
    hashtags: (PlainHashtag & {
      hashtagId: bigint;
    })[];
  }> {
    if (!content || content.length === 0) {
      return { mentions: [], hashtags: [] };
    }
    const { mentions: plainMentions, hashtags: plainHashtags } = this.parsePlainContent(content);
    const mentions = await this.usersService.checkUsernamesExistenceAndReplaceIds(
      plainMentions,
      tx,
    );
    const hashtags = await this.trendingService.createOrIncrementHashtags(plainHashtags, tx);
    return { mentions, hashtags };
  }

  /**
   * Parse content for profile bios - validates mentions but doesn't track hashtags
   *
   * @param content The bio text to parse
   * @param tx a transaction client
   * @returns Mentions with their IDs from the database, and plain hashtags (not saved to DB)
   */
  async parseContentForBio(
    content: string,
    tx: Prisma.TransactionClient,
  ): Promise<{
    mentions: (PlainMention & { userId: bigint })[];
    hashtags: PlainHashtag[];
  }> {
    if (!content || content.length === 0) {
      return { mentions: [], hashtags: [] };
    }

    const { mentions: plainMentions, hashtags: plainHashtags } = this.parsePlainContent(content);

    // Only validate mentions
    const mentions = await this.usersService.checkUsernamesExistenceAndReplaceIds(
      plainMentions,
      tx,
    );

    // Return plain hashtags without database interaction
    return { mentions, hashtags: plainHashtags };
  }
  /**
   *
   * @param content The text to parse (tweet, bio or message)
   * @returns An array of mentions and hashtags with their starting positions (need to be checked against db)
   */
  private parsePlainContent(content: string): ParsedContent {
    if (!content || content.length === 0) {
      return {
        mentions: [],
        hashtags: [],
      };
    }

    // (alphanumeric + underscore, 1-15 chars, not preceded by anything)
    const mentionRegex = /(?<!\w)@(\w{1,15})/g;
    // (alphanumeric, 1-100 chars, not preceded by anything)
    const hashtagRegex = /(?<!\w)#([a-zA-Z0-9_]{1,100})/g;

    const mentionMatches = content.matchAll(mentionRegex);
    const hashtagMatches = content.matchAll(hashtagRegex);

    const usernames: Array<PlainMention> = Array.from(mentionMatches).map((match) => {
      return {
        username: match[1],
        startPosition: match.index,
      };
    });

    const hashtags: Array<PlainHashtag> = Array.from(hashtagMatches).map((match) => {
      return {
        keyword: match[1],
        startPosition: match.index,
      };
    });

    return {
      mentions: usernames,
      hashtags: hashtags,
    };
  }
}
