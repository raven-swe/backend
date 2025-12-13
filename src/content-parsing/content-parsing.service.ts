import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ParsedContent } from 'src/common/interfaces/parsed-content.interface';
import { TrendingService } from 'src/trending/trending.service';
import { PlainHashtag, PlainMention } from 'src/tweets/interfaces';
import { UsersService } from 'src/users/users.service';
import Groq from 'groq-sdk';

@Injectable()
export class ContentParsingService {
  private readonly logger = new Logger(ContentParsingService.name);
  private groq: Groq;

  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly trendingService: TrendingService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('SUMMARY_API_KEY');
    if (!apiKey) {
      this.logger.error('SUMMARY_API_KEY is not configured');
      throw new Error('SUMMARY_API_KEY environment variable is required');
    }
    this.groq = new Groq({ apiKey: apiKey });
  }

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

  /**
   * @param content The tweet content to summarize
   * @returns A concise summary of the tweet
   */
  async generateTweetSummary(content: string, langcode?: string): Promise<string> {
    try {
      const modelId = 'openai/gpt-oss-120b';

      let language = 'en-US';
      if (langcode) {
        language = langcode;
      }

      const englishPrompt = `
      You are generating a short explanation for users in the app UI.

      Summarize the following tweet in a simple, user-friendly sentence.
      The sentence MUST start with: "The tweet is talking about ..."

      The goal is clarity for users, not strict character length comparison.
      If the tweet is very short, empty, or unclear, still provide a brief meaningful explanation.

      Tweet:
      ${content}
      `;

      const arabicPrompt = `
      أنت تقوم بإنشاء شرح قصير لعرضه للمستخدم داخل واجهة التطبيق.

      لخص التغريدة التالية باللهجة المصرية بجملة بسيطة وواضحة.
      يجب أن يبدأ الشرح بعبارة: "التغريدة تتحدث عن ..."

      الهدف هو التوضيح للمستخدم، وليس الالتزام بعدد أحرف أقل من التغريدة.
      إذا كانت التغريدة قصيرة جداً أو غير واضحة، قدّم شرحاً مختصراً مفيداً.

      التغريدة:
      ${content}
      `;

      const prompt = language.startsWith('ar') ? arabicPrompt : englishPrompt;

      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: modelId,
      });

      const summary = completion.choices[0]?.message?.content || '';

      this.logger.log(`Generated summary for tweet content using ${modelId}`);
      return summary.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to generate tweet summary: ${errorMessage}`, errorStack);
      throw new Error('Failed to generate tweet summary');
    }
  }
}
