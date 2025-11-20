import { ParsedContent } from '../interfaces/parsed-content.interface';
import { PlainMention, PlainHashtag } from 'src/tweets/interfaces';
/**
 *
 * @param content The text to parse (tweet, bio or message)
 * @returns An array of mentions and hashtags with their starting positions (need to be checked against db)
 * // TODO make the db check centralized in a function instead of being in multiple repos
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
