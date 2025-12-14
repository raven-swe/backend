import { NotificationType, LanguageCode } from '@prisma/client';
import IntlMessageFormat from 'intl-messageformat';

const DEFAULT_LOCALE: LanguageCode = LanguageCode.EN;

const TEMPLATES: Record<string, Record<string, string>> = {
  EN: {
    'like.single': '{actor} liked your tweet',
    'like.aggregated': '{actor} and {count} other{s} liked your tweet',
    'follow.single': '{actor} followed you',
    'follow.aggregated': '{actor} and {count} other{s} followed you',
    'reply.single': '{actor} replied: "{snippet}"',
    'mention.single': '{actor} mentioned you: "{snippet}"',
    'quote.single': '{actor} quoted: "{snippet}"',
    'retweet.single': '{actor} retweeted your tweet',
    'retweet.aggregated': '{actor} and {count} other{s} retweeted your tweet',
    'author.tweet': '{actor} posted a new tweet',
    generic: 'New interaction',
    'generic.body': 'You have a new notification',
  },
  AR: {
    'like.single': 'أعجب {actor} بتغريدتك',
    'like.aggregated': 'أعجب {actor} و{count} آخر{sar} بتغريدتك',
    'follow.single': '{actor} تابعك',
    'follow.aggregated': '{actor} و{count} آخر{sar} تابعوك',
    'reply.single': '{actor} رد: "{snippet}"',
    'mention.single': '{actor} ذكرك: "{snippet}"',
    'quote.single': '{actor} اقتبس: "{snippet}"',
    'retweet.single': '{actor} أعاد تغريد تغريدتك',
    'retweet.aggregated': '{actor} و{count} آخر{sar} أعادوا تغريد تغريدتك',
    'author.tweet': '{actor} نشر تغريدة جديدة',
    generic: 'تفاعل جديد',
    'generic.body': 'لديك إشعار جديد',
  },
};

function sanitizeText(s: string): string {
  if (!s) return '';
  const arr = Array.from(s);
  for (let i = 0; i < arr.length; i++) {
    const code = arr[i].charCodeAt(0);
    if (code < 32 || (code >= 127 && code <= 159)) arr[i] = ' ';
  }
  return arr.join('').replace(/\s+/g, ' ').trim();
}

function truncate(s: string, n: number) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n - 1).trim() + '…';
}

function safeParamToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v as unknown);
  }
}

export function buildFcmNotificationText(opts: {
  notificationType: NotificationType;
  isAggregated?: boolean;
  previewActors?: string[];
  totalActorCount?: number;
  tweetSnippet?: string | null;
  locale?: LanguageCode;
}): { title: string; body?: string } {
  const {
    notificationType,
    isAggregated = false,
    previewActors = [],
    totalActorCount = 1,
    tweetSnippet,
    locale,
  } = opts;

  const templates = locale ? TEMPLATES[locale] : TEMPLATES[DEFAULT_LOCALE];

  const leadActor = previewActors[0] ?? 'Someone';
  const remainingCount = Math.max(0, (totalActorCount ?? 1) - 1);

  let key = 'generic';
  const params: Record<string, unknown> = {};

  if (locale === LanguageCode.AR && isAggregated && remainingCount > 0) {
    params.sar = remainingCount === 1 ? '' : 'ون';
  } else if (locale === LanguageCode.EN && isAggregated && remainingCount > 0) {
    params.s = remainingCount === 1 ? '' : 's';
  }
  switch (notificationType) {
    case NotificationType.LIKE:
      if (isAggregated && remainingCount > 0) {
        key = 'like.aggregated';
        params.actor = leadActor;
        params.count = remainingCount;
      } else {
        key = 'like.single';
        params.actor = leadActor;
      }
      break;

    case NotificationType.FOLLOW:
      if (isAggregated && remainingCount > 0) {
        key = 'follow.aggregated';
        params.actor = leadActor;
        params.count = remainingCount;
      } else {
        key = 'follow.single';
        params.actor = leadActor;
      }
      break;

    case NotificationType.REPLY:
      if (isAggregated && remainingCount > 0) {
        key = 'reply.aggregated';
        params.actor = leadActor;
        params.count = remainingCount;
        params.snippet = truncate(sanitizeText(tweetSnippet ?? ''), 80);
      } else {
        key = 'reply.single';
        params.actor = leadActor;
        params.snippet = truncate(sanitizeText(tweetSnippet ?? ''), 80);
      }
      break;

    case NotificationType.MENTION:
      key = 'mention.single';
      params.actor = leadActor;
      params.snippet = truncate(sanitizeText(tweetSnippet ?? ''), 80);
      break;

    case NotificationType.QUOTE:
      if (isAggregated && remainingCount > 0) {
        key = 'qoute.aggregated';
        params.actor = leadActor;
        params.count = remainingCount;
        params.snippet = truncate(sanitizeText(tweetSnippet ?? ''), 80);
      } else {
        key = 'quote.single';
        params.actor = leadActor;
        params.snippet = truncate(sanitizeText(tweetSnippet ?? ''), 80);
      }
      break;

    case NotificationType.RETWEET:
      if (isAggregated && remainingCount > 0) {
        key = 'retweet.aggregated';
        params.actor = leadActor;
        params.count = remainingCount;
      } else {
        key = 'retweet.single';
        params.actor = leadActor;
      }
      break;

    case NotificationType.TWEET:
      key = 'author.tweet';
      params.actor = leadActor;
      break;

    default:
      key = 'generic';
      break;
  }

  const template = templates[key] ?? templates['generic'];

  let title = template;
  try {
    const msg = new IntlMessageFormat(template, locale);
    const safeParams: Record<string, string | number | boolean> = {};
    for (const k of Object.keys(params)) {
      const v = params[k];
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        safeParams[k] = v;
      } else {
        safeParams[k] = safeParamToString(v);
      }
    }
    title = String(msg.format(safeParams));
  } catch (err) {
    console.warn('i18n format failed', err);
    title = template.replace(/\{([^}]+)\}/g, (_, p: string) => {
      return safeParamToString(params[p]) ?? '';
    });
  }

  const conversationalTypes = new Set<NotificationType>([
    NotificationType.REPLY,
    NotificationType.MENTION,
    NotificationType.QUOTE,
  ]);

  let body: string | undefined = undefined;
  if (conversationalTypes.has(notificationType)) {
    const snippet = truncate(sanitizeText(tweetSnippet ?? ''), 120);
    body = snippet || templates['generic.body'] || '';
  } else {
    if (notificationType === NotificationType.LIKE && !isAggregated) {
      if (tweetSnippet) {
        body = truncate(sanitizeText(tweetSnippet), 120);
      }
    } else {
      body = templates['generic.body'];
    }
  }

  title = truncate(sanitizeText(title), 50);
  if (body) body = truncate(sanitizeText(body), 120);

  return { title, body };
}
