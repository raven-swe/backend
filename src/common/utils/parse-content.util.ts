import { ParsedContent } from '../interfaces/parsed-content.interface';
import { Mention } from '../interfaces/mention-interface';
import { Hashtag } from '../interfaces/hashtag-interface';

/**
 *
 * @param content The text to parse (tweet, bio or message)
 * @returns a
 */
export function parseContent(content: string): ParsedContent {
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

  const usernames: Array<Mention> = Array.from(mentionMatches).map((match) => {
    return {
      username: match[1].toLowerCase(),
      startingIndex: match.index,
    };
  });

  const hashtags: Array<Hashtag> = Array.from(hashtagMatches).map((match) => {
    return {
      tag: match[1].toLowerCase(),
      startingIndex: match.index,
    };
  });

  return {
    mentions: usernames,
    hashtags: hashtags,
  };
}
