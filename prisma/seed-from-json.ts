import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface UserData {
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  birthdate: string;
  interests?: string[];
  location?: string;
  avatarUrl?: string;
  createdAt?: string;
}

interface MediaData {
  url: string;
  type: 'IMAGE' | 'VIDEO' | 'GIF';
  width?: number;
  height?: number;
  altText?: string;
}

interface TweetData {
  userIndex: number;
  content: string;
  category: string;
  hashtags?: string[];
  mentions?: string[];
  daysAgo?: number;
  hoursAgo?: number;
  minutesAgo?: number;
  media?: MediaData[];
  quotedTweetIndex?: number; // Index in tweets array to quote
  replyToTweetIndex?: number; // Index in tweets array to reply to
  createdAt?: string;
}

interface RetweetData {
  userIndex: number;
  tweetIndex: number; // Index of tweet to retweet
  daysAgo?: number;
  hoursAgo?: number;
  minutesAgo?: number;
  createdAt?: string;
}

interface LikeData {
  userIndex: number;
  tweetIndex: number;
  daysAgo?: number;
  hoursAgo?: number;
  minutesAgo?: number;
  createdAt?: string;
}

interface SeedData {
  meta?: {
    mode: string;
  };
  users: UserData[];
  tweets: TweetData[];
  retweets?: RetweetData[];
  likes?: LikeData[];
}

function parseHashtags(content: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const matches = content.matchAll(hashtagRegex);
  return Array.from(matches, (m) => m[1]);
}

function parseMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = content.matchAll(mentionRegex);
  return Array.from(matches, (m) => m[1]);
}

function calculateCreatedAt(daysAgo?: number, hoursAgo?: number, minutesAgo?: number): Date {
  const now = new Date();

  if (minutesAgo !== undefined) {
    return new Date(now.getTime() - minutesAgo * 60 * 1000);
  }

  if (hoursAgo !== undefined) {
    return new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
  }

  if (daysAgo !== undefined) {
    return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  }

  // Random time in last 30 days if nothing specified
  const randomDays = Math.floor(Math.random() * 30);
  return new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);
}

async function getOrCreateHashtag(keyword: string) {
  return prisma.hashtag.upsert({
    where: { keyword },
    update: {},
    create: { keyword },
  });
}

async function main() {
  const dataPath = path.join(__dirname, 'seed-data.json');

  if (!fs.existsSync(dataPath)) {
    console.error(' seed-data.json not found!');
    console.log(' Create seed-data.json based on seed-data.json.example');
    process.exit(1);
  }

  const data: SeedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const isTrendingMode = data.meta?.mode === 'trending';

  if (isTrendingMode) {
    console.log(' Trending mode detected: Skipping database clean/wipe. Appending new data...');
  } else {
    console.log(' Cleaning database...');
    // Clean in correct order to avoid foreign key violations
    await prisma.tweet.updateMany({
      data: { quotedTweetId: null, replyToTweetId: null, rootTweetId: null },
    });
    await prisma.conversation.updateMany({ data: { lastMessageId: null } });
    await prisma.conversationParticipant.updateMany({ data: { lastSeenMessageId: null } });

    await prisma.notification.deleteMany();
    await prisma.conversationParticipant.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.like.deleteMany();
    await prisma.retweet.deleteMany();
    await prisma.tweetMedia.deleteMany();
    await prisma.media.deleteMany();
    await prisma.tweetHashtag.deleteMany();
    await prisma.trendingKeyword.deleteMany();
    await prisma.hashtag.deleteMany();
    await prisma.tweetMention.deleteMany();
    await prisma.tweet.deleteMany();
    await prisma.mute.deleteMany();
    await prisma.block.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userDevice.deleteMany();
    await prisma.userExternalAccount.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
  }

  console.log(` Creating ${data.users.length} users...`);

  // Bulk insert users
  await prisma.user.createMany({
    data: data.users.map((userData) => ({
      username: userData.username,
      email: userData.email,
      passwordHash: '$2a$10$faoFdN3VO833Agy0pdZRS.OozTd8R5Z.aEUnK/1fxwByQjx/OPBii', // password: "password123"
      birthdate: new Date(userData.birthdate),
      interests: userData.interests || [],
    })),
    skipDuplicates: true,
  });

  // Fetch created users to get their IDs
  const createdUsers = await prisma.user.findMany({
    where: {
      username: { in: data.users.map((u) => u.username) },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Create a map for quick lookup
  const usernameToUser = new Map(createdUsers.map((u) => [u.username, u]));

  // Bulk insert profiles
  await prisma.profile.createMany({
    data: data.users
      .map((userData) => {
        const user = usernameToUser.get(userData.username);
        if (!user) return null;
        return {
          userId: user.id,
          displayName: userData.displayName,
          bio: userData.bio || null,
          location: userData.location || null,
          avatarUrl: userData.avatarUrl || null,
        };
      })
      .filter((profile) => profile !== null),
    skipDuplicates: true,
  });

  console.log(`Created ${createdUsers.length} users`);

  console.log(`\nCreating ${data.tweets.length} tweets...`);

  // Create a map for username lookups
  const usernameToId = new Map(createdUsers.map((u) => [u.username.toLowerCase(), u.id]));

  // Collect all unique hashtags and create them in bulk
  const allHashtagsSet = new Set<string>();
  data.tweets.forEach((tweetData) => {
    const hashtagsInContent = parseHashtags(tweetData.content);
    const allHashtags = [...new Set([...(tweetData.hashtags || []), ...hashtagsInContent])];
    allHashtags.forEach((tag) => allHashtagsSet.add(tag.toLowerCase()));
  });

  if (allHashtagsSet.size > 0) {
    await prisma.hashtag.createMany({
      data: Array.from(allHashtagsSet).map((keyword) => ({ keyword })),
      skipDuplicates: true,
    });
    console.log(`Created ${allHashtagsSet.size} unique hashtags`);
  }

  // Fetch all hashtags for lookup
  const allHashtags = await prisma.hashtag.findMany();
  const hashtagMap = new Map(allHashtags.map((h) => [h.keyword, h.id]));
  console.log(`Fetched ${allHashtags.length} hashtags for mapping`);

  // Prepare all media records for bulk insertion
  const allMediaData: any[] = [];
  data.tweets.forEach((tweetData, tweetIndex) => {
    if (tweetData.media && tweetData.media.length > 0) {
      const user = createdUsers[tweetData.userIndex];
      if (user) {
        tweetData.media.forEach((mediaData, mediaIndex) => {
          allMediaData.push({
            userId: user.id,
            type: mediaData.type,
            url: mediaData.url,
            width: mediaData.width || null,
            height: mediaData.height || null,
            altText: mediaData.altText || null,
            pending: false,
            _tweetIndex: tweetIndex,
            _mediaOrder: mediaIndex,
          });
        });
      }
    }
  });

  // Bulk insert media
  if (allMediaData.length > 0) {
    await prisma.media.createMany({
      data: allMediaData.map(({ _tweetIndex, _mediaOrder, ...data }) => data),
      skipDuplicates: true,
    });
  }

  // Fetch created media
  const createdMedia = await prisma.media.findMany({
    where: {
      userId: { in: createdUsers.map((u) => u.id) },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Create a map of media by URL for lookup
  const mediaByUrl = new Map(createdMedia.map((m) => [m.url, m]));

  // First pass: Create all tweets without relationships (quotes/replies)
  const tweetDataToCreate = data.tweets
    .map((tweetData, index) => {
      const user = createdUsers[tweetData.userIndex];
      if (!user) return null;

      const hashtagsInContent = parseHashtags(tweetData.content);
      const allHashtags = [...new Set([...(tweetData.hashtags || []), ...hashtagsInContent])].map(
        (tag) => tag.toLowerCase(),
      );
      const mentionsInContent = parseMentions(tweetData.content);
      const allMentions = [...new Set([...(tweetData.mentions || []), ...mentionsInContent])];
      const mentionedUserIds = allMentions
        .map((username) => usernameToId.get(username.toLowerCase()))
        .filter((id) => id !== undefined);

      const createdAt = tweetData.createdAt
        ? new Date(tweetData.createdAt)
        : calculateCreatedAt(tweetData.daysAgo, tweetData.hoursAgo, tweetData.minutesAgo);

      const hasMedia = tweetData.media && tweetData.media.length > 0;

      return {
        userId: user.id,
        content: tweetData.content,
        class: null,
        hasHashtags: allHashtags.length > 0,
        hasMentions: mentionedUserIds.length > 0,
        hasMedia,
        createdAt,
        _originalIndex: index,
        _hashtags: allHashtags,
        _mentions: allMentions,
        _mentionedUserIds: mentionedUserIds,
        _mediaUrls: tweetData.media?.map((m) => m.url) || [],
      };
    })
    .filter((t) => t !== null);

  // Bulk insert tweets
  await prisma.tweet.createMany({
    data: tweetDataToCreate.map(
      ({ _originalIndex, _hashtags, _mentions, _mentionedUserIds, _mediaUrls, ...data }) => data,
    ),
  });

  // Fetch created tweets
  const createdTweets = await prisma.tweet.findMany({
    where: {
      userId: { in: createdUsers.map((u) => u.id) },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Create a mapping from tweet data to created tweets using content + userId as key
  const tweetMap = new Map<string, any>();
  createdTweets.forEach((tweet) => {
    const key = `${tweet.userId}-${tweet.content}-${tweet.createdAt.getTime()}`;
    tweetMap.set(key, tweet);
  });

  // Map tweetDataToCreate to actual created tweets
  const tweetDataWithIds = tweetDataToCreate.map((tweetData) => {
    const key = `${tweetData.userId}-${tweetData.content}-${tweetData.createdAt.getTime()}`;
    const tweet = tweetMap.get(key);
    return {
      ...tweetData,
      _tweetId: tweet?.id,
      _tweet: tweet,
    };
  });

  console.log(`Created ${createdTweets.length} tweets`);

  // Second pass: Update tweets with quote/reply relationships
  const tweetsToUpdate: any[] = [];
  data.tweets.forEach((tweetData, index) => {
    if (tweetData.quotedTweetIndex !== undefined || tweetData.replyToTweetIndex !== undefined) {
      const tweetWithId = tweetDataWithIds[index];
      if (tweetWithId && tweetWithId._tweetId) {
        const updateData: any = {};

        if (tweetData.quotedTweetIndex !== undefined) {
          const quotedTweetWithId = tweetDataWithIds[tweetData.quotedTweetIndex];
          if (quotedTweetWithId && quotedTweetWithId._tweetId) {
            updateData.quotedTweetId = quotedTweetWithId._tweetId;
          }
        }

        if (tweetData.replyToTweetIndex !== undefined) {
          const replyToTweetWithId = tweetDataWithIds[tweetData.replyToTweetIndex];
          if (replyToTweetWithId && replyToTweetWithId._tweet) {
            updateData.replyToTweetId = replyToTweetWithId._tweetId;
            updateData.rootTweetId =
              replyToTweetWithId._tweet.rootTweetId || replyToTweetWithId._tweetId;
          }
        }

        if (Object.keys(updateData).length > 0) {
          tweetsToUpdate.push({ id: tweetWithId._tweetId, ...updateData });
        }
      }
    }
  });

  // Update tweets with relationships using transaction
  if (tweetsToUpdate.length > 0) {
    await prisma.$transaction(
      tweetsToUpdate.map((update) => {
        const { id, ...data } = update;
        return prisma.tweet.update({
          where: { id },
          data,
        });
      }),
    );

    console.log(`Updated ${tweetsToUpdate.length} tweets with quote/reply relationships`);
  }

  // Bulk insert tweet hashtags
  const tweetHashtagsToCreate: any[] = [];
  tweetDataWithIds.forEach((tweetData) => {
    if (tweetData._tweetId && tweetData._hashtags.length > 0) {
      tweetData._hashtags.forEach((hashtag) => {
        const hashtagId = hashtagMap.get(hashtag.toLowerCase());
        if (hashtagId) {
          const hashtagText = `#${hashtag}`;
          const startPosition = tweetData.content.indexOf(hashtagText);
          tweetHashtagsToCreate.push({
            tweetId: tweetData._tweetId,
            hashtagId,
            startPosition: startPosition >= 0 ? startPosition : 0,
          });
        } else {
          console.warn(
            `Warning: Hashtag "${hashtag}" not found in hashtagMap for tweet ${tweetData._tweetId}`,
          );
        }
      });
    }
  });

  if (tweetHashtagsToCreate.length > 0) {
    await prisma.tweetHashtag.createMany({
      data: tweetHashtagsToCreate,
      skipDuplicates: true,
    });
    console.log(`Created ${tweetHashtagsToCreate.length} tweet-hashtag relationships`);
  } else {
    console.log('No tweet-hashtag relationships to create');
  }

  // Bulk insert tweet mentions
  const tweetMentionsToCreate: any[] = [];
  tweetDataWithIds.forEach((tweetData) => {
    if (tweetData._tweetId && tweetData._mentionedUserIds.length > 0) {
      tweetData._mentionedUserIds.forEach((userId, idx) => {
        const mentionText = `@${tweetData._mentions[idx]}`;
        const startPosition = tweetData.content.indexOf(mentionText);
        tweetMentionsToCreate.push({
          tweetId: tweetData._tweetId,
          userId,
          startPosition: startPosition >= 0 ? startPosition : 0,
        });
      });
    }
  });

  if (tweetMentionsToCreate.length > 0) {
    await prisma.tweetMention.createMany({
      data: tweetMentionsToCreate,
      skipDuplicates: true,
    });
    console.log(`Created ${tweetMentionsToCreate.length} tweet-mention relationships`);
  }

  // Bulk insert tweet media
  const tweetMediaToCreate: any[] = [];
  tweetDataWithIds.forEach((tweetData) => {
    if (tweetData._tweetId && tweetData._mediaUrls.length > 0) {
      tweetData._mediaUrls.forEach((url, order) => {
        const media = mediaByUrl.get(url);
        if (media) {
          tweetMediaToCreate.push({
            tweetId: tweetData._tweetId,
            mediaId: media.id,
            order,
          });
        }
      });
    }
  });

  if (tweetMediaToCreate.length > 0) {
    await prisma.tweetMedia.createMany({
      data: tweetMediaToCreate,
      skipDuplicates: true,
    });
    console.log(`Created ${tweetMediaToCreate.length} tweet-media relationships`);
  }

  // Create retweets if present
  if (data.retweets && data.retweets.length > 0) {
    console.log(`\n Creating ${data.retweets.length} retweets...`);

    const retweetsToCreate = data.retweets
      .map((retweetData) => {
        const user = createdUsers[retweetData.userIndex];
        const tweetWithId = tweetDataWithIds[retweetData.tweetIndex];

        if (!user || !tweetWithId || !tweetWithId._tweetId) {
          console.error(
            `   ❌ Invalid retweet reference: user ${retweetData.userIndex}, tweet ${retweetData.tweetIndex}`,
          );
          return null;
        }

        const createdAt = retweetData.createdAt
          ? new Date(retweetData.createdAt)
          : calculateCreatedAt(retweetData.daysAgo, retweetData.hoursAgo, retweetData.minutesAgo);

        return {
          userId: user.id,
          tweetId: tweetWithId._tweetId,
          createdAt,
        };
      })
      .filter((r) => r !== null);

    // Bulk insert retweets
    await prisma.retweet.createMany({
      data: retweetsToCreate,
      skipDuplicates: true,
    });

    // Update retweet counts
    await prisma.$executeRawUnsafe(`
      UPDATE "tweets" t
      SET "retweet_count" = sub.count
      FROM (
        SELECT "tweet_id", COUNT(*) AS count
        FROM "retweets"
        GROUP BY "tweet_id"
      ) AS sub
      WHERE t.id = sub.tweet_id;
    `);

    console.log(`Created ${retweetsToCreate.length} retweets`);
  }

  // Create likes if present
  if (data.likes && data.likes.length > 0) {
    console.log(`\n Creating ${data.likes.length} likes...`);

    const likesToCreate = data.likes
      .map((likeData) => {
        const user = createdUsers[likeData.userIndex];
        const tweetWithId = tweetDataWithIds[likeData.tweetIndex];

        if (!user || !tweetWithId || !tweetWithId._tweetId) {
          console.error(
            `   ❌ Invalid like reference: user ${likeData.userIndex}, tweet ${likeData.tweetIndex}`,
          );
          return null;
        }

        const createdAt = likeData.createdAt
          ? new Date(likeData.createdAt)
          : calculateCreatedAt(likeData.daysAgo, likeData.hoursAgo, likeData.minutesAgo);

        return {
          userId: user.id,
          tweetId: tweetWithId._tweetId,
          createdAt,
        };
      })
      .filter((l) => l !== null);

    // Bulk insert likes
    await prisma.like.createMany({
      data: likesToCreate,
      skipDuplicates: true,
    });

    // Update like counts
    await prisma.$executeRawUnsafe(`
      UPDATE "tweets" t
      SET "like_count" = sub.count
      FROM (
        SELECT "tweet_id", COUNT(*) AS count
        FROM "likes"
        GROUP BY "tweet_id"
      ) AS sub
      WHERE t.id = sub.tweet_id;
    `);

    console.log(`Created ${likesToCreate.length} likes`);
  }

  // Create some random follows for engagement
  console.log('\nCreating follow relationships...');
  const followsToCreate: Array<{ followerId: bigint; followedId: bigint }> = [];

  for (let i = 0; i < Math.min(createdUsers.length * 5, 5000); i++) {
    const follower = createdUsers[Math.floor(Math.random() * createdUsers.length)];
    const followed = createdUsers[Math.floor(Math.random() * createdUsers.length)];

    if (follower.id !== followed.id) {
      followsToCreate.push({
        followerId: follower.id,
        followedId: followed.id,
      });
    }
  }

  // Remove duplicates
  const uniqueFollows = Array.from(
    new Map(followsToCreate.map((f) => [`${f.followerId}-${f.followedId}`, f])).values(),
  );

  await prisma.follow.createMany({
    data: uniqueFollows,
    skipDuplicates: true,
  });

  console.log(` Created ${uniqueFollows.length} follow relationships`);

  // Update follower/following counts
  console.log('\n Updating follower/following counts...');
  await prisma.$executeRawUnsafe(`
    UPDATE "users" u
    SET "followers_count" = sub.count
    FROM (
      SELECT "followed_id" AS user_id, COUNT(*) AS count
      FROM "follows"
      GROUP BY "followed_id"
    ) AS sub
    WHERE u.id = sub.user_id;
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "users" u
    SET "following_count" = sub.count
    FROM (
      SELECT "follower_id" AS user_id, COUNT(*) AS count
      FROM "follows"
      GROUP BY "follower_id"
    ) AS sub
    WHERE u.id = sub.user_id;
  `);

  // Update tweet reply counts
  console.log('\n Updating tweet reply counts...');
  await prisma.$executeRawUnsafe(`
    UPDATE "tweets" t
    SET "reply_count" = sub.count
    FROM (
      SELECT "reply_to_tweet_id", COUNT(*) AS count
      FROM "tweets"
      WHERE "reply_to_tweet_id" IS NOT NULL
      GROUP BY "reply_to_tweet_id"
    ) AS sub
    WHERE t.id = sub.reply_to_tweet_id;
  `);

  const retweetCount = data.retweets?.length || 0;
  const mediaCount = await prisma.media.count();
  const quotedCount = await prisma.tweet.count({ where: { quotedTweetId: { not: null } } });
  const replyCount = await prisma.tweet.count({ where: { replyToTweetId: { not: null } } });

  console.log('\nDatabase seeded successfully!');
  console.log(`   Users: ${createdUsers.length}`);
  console.log(`   Tweets: ${createdTweets.length}`);
  console.log(`   Hashtags: ${allHashtags.length}`);
  console.log(`   Tweet-Hashtag relationships: ${tweetHashtagsToCreate.length}`);
  console.log(`   Tweet-Mention relationships: ${tweetMentionsToCreate.length}`);
  console.log(`   Retweets: ${retweetCount}`);
  console.log(`   Replies: ${replyCount}`);
  console.log(`   Quotes: ${quotedCount}`);
  console.log(`   Media: ${mediaCount}`);
  console.log(`   Follows: ${uniqueFollows.length}`);
  console.log(`   Likes: ${data.likes?.length || 0}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
