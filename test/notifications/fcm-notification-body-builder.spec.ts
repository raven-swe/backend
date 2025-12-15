import { buildFcmNotificationText } from '../../src/notifications/utils/fcm-notification-body-builder';
import { NotificationType, LanguageCode, MediaType } from '@prisma/client';

describe('buildFcmNotificationText', () => {
  const actor = 'Alice';
  const snippet = 'Hello World';

  describe('English (Default)', () => {
    it('should handle LIKE notification (single)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.LIKE,
        previewActors: [actor],
        tweetSnippet: snippet,
      });
      expect(result.title).toBe(`${actor} liked your tweet`);
      expect(result.body).toBe(snippet);
    });

    it('should handle LIKE notification (aggregated)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.LIKE,
        isAggregated: true,
        previewActors: [actor],
        totalActorCount: 3,
        tweetSnippet: snippet,
      });
      expect(result.title).toBe(`${actor} and 2 others liked your tweet`);
      expect(result.body).toBe('You have a new notification');
    });

    it('should handle FOLLOW notification (single)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.FOLLOW,
        previewActors: [actor],
      });
      expect(result.title).toBe(`${actor} followed you`);
      expect(result.body).toBe('You have a new notification');
    });

    it('should handle FOLLOW notification (aggregated)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.FOLLOW,
        isAggregated: true,
        previewActors: [actor],
        totalActorCount: 3,
      });
      expect(result.title).toBe(`${actor} and 2 others followed you`);
    });

    it('should handle REPLY notification (single)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.REPLY,
        previewActors: [actor],
        tweetSnippet: snippet,
      });
      expect(result.title).toBe(`${actor} replied: "${snippet}"`);
      expect(result.body).toBe(snippet);
    });

    it('should handle MENTION notification', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.MENTION,
        previewActors: [actor],
        tweetSnippet: snippet,
      });
      expect(result.title).toBe(`${actor} mentioned you: "${snippet}"`);
      expect(result.body).toBe(snippet);
    });

    it('should handle QUOTE notification (single)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.QUOTE,
        previewActors: [actor],
        tweetSnippet: snippet,
      });
      expect(result.title).toBe(`${actor} quoted: "${snippet}"`);
      expect(result.body).toBe(snippet);
    });

    it('should handle QUOTE notification (aggregated)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.QUOTE,
        isAggregated: true,
        previewActors: [actor],
        totalActorCount: 3,
        tweetSnippet: snippet,
      });
      expect(result.title).toBe('New interaction');
    });

    it('should handle RETWEET notification (single)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.RETWEET,
        previewActors: [actor],
      });
      expect(result.title).toBe(`${actor} retweeted your tweet`);
    });

    it('should handle RETWEET notification (aggregated)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.RETWEET,
        isAggregated: true,
        previewActors: [actor],
        totalActorCount: 3,
      });
      expect(result.title).toBe(`${actor} and 2 others retweeted your tweet`);
    });

    it('should handle TWEET notification', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.TWEET,
        previewActors: [actor],
      });
      expect(result.title).toBe(`${actor} posted a new tweet`);
    });

    it('should handle MESSAGE notification (text)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.MESSAGE,
        previewActors: [actor],
        tweetSnippet: snippet,
      });
      expect(result.title).toBe(`${actor} sent you a message: "${snippet}"`);
    });

    it('should handle MESSAGE notification (reaction)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.MESSAGE,
        previewActors: [actor],
        tweetSnippet: snippet,
        reaction: '❤️',
      });
      expect(result.title).toBe(`${actor} reacted ❤️ to your message: "${snippet}"`);
    });

    it('should handle MESSAGE notification (photo)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.MESSAGE,
        previewActors: [actor],
        hasMedia: true,
        mediaType: MediaType.IMAGE,
      });
      expect(result.title).toBe(`${actor} sent you a photo`);
    });

    it('should handle MESSAGE notification (video)', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.MESSAGE,
        previewActors: [actor],
        hasMedia: true,
        mediaType: MediaType.VIDEO,
      });
      expect(result.title).toBe(`${actor} sent you a video`);
    });
  });

  describe('Arabic Localization', () => {
    const locale = LanguageCode.AR;

    it('should handle LIKE notification (single) in Arabic', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.LIKE,
        previewActors: [actor],
        locale,
      });
      expect(result.title).toBe(`أعجب ${actor} بتغريدتك`);
    });

    it('should handle LIKE notification (aggregated) in Arabic', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.LIKE,
        isAggregated: true,
        previewActors: [actor],
        totalActorCount: 3,
        locale,
      });
      expect(result.title).toBe(`أعجب ${actor} و2 آخرون بتغريدتك`);
    });
  });

  describe('Sanitization and Truncation', () => {
    it('should sanitize and truncate long text', () => {
      const longSnippet = 'a'.repeat(200);
      const result = buildFcmNotificationText({
        notificationType: NotificationType.REPLY,
        previewActors: [actor],
        tweetSnippet: longSnippet,
      });

      expect(result.title.length).toBeLessThanOrEqual(50);
      expect(result.title.endsWith('…')).toBe(true);

      expect(result.body?.length).toBeLessThanOrEqual(120);
    });

    it('should remove control characters', () => {
      const dirtySnippet = 'Hello\n\tWorld';
      const result = buildFcmNotificationText({
        notificationType: NotificationType.REPLY,
        previewActors: [actor],
        tweetSnippet: dirtySnippet,
      });
      expect(result.title).toContain('Hello World');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing previewActors', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.LIKE,
        previewActors: [],
      });
      expect(result.title).toBe('Someone liked your tweet');
    });

    it('should fallback to generic for unknown types or missing templates', () => {
      const result = buildFcmNotificationText({
        notificationType: NotificationType.REPLY,
        isAggregated: true,
        previewActors: [actor],
        totalActorCount: 3,
        tweetSnippet: snippet,
      });
      expect(result.title).toBe('New interaction');
    });
  });
});
