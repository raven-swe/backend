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
}

interface RetweetData {
  userIndex: number;
  tweetIndex: number; // Index of tweet to retweet
  daysAgo?: number;
  hoursAgo?: number;
  minutesAgo?: number;
}

interface SeedData {
  users: UserData[];
  tweets: TweetData[];
  retweets?: RetweetData[];
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

  console.log(` Creating ${data.users.length} users...`);
  const createdUsers = [];

  for (let i = 0; i < data.users.length; i++) {
    const userData = data.users[i];

    try {
      const user = await prisma.user.create({
        data: {
          username: userData.username,
          email: userData.email,
          passwordHash: '$2a$10$faoFdN3VO833Agy0pdZRS.OozTd8R5Z.aEUnK/1fxwByQjx/OPBii', // password: "password123"
          birthdate: new Date(userData.birthdate),
          interests: userData.interests || [],
          profile: {
            create: {
              displayName: userData.displayName,
              bio: userData.bio || null,
              location: userData.location || null,
              avatarUrl: userData.avatarUrl || null,
            },
          },
        },
      });

      createdUsers.push(user);

      if ((i + 1) % 100 === 0) {
        console.log(`  Created ${i + 1}/${data.users.length} users`);
      }
    } catch (error) {
      console.error(`   Failed to create user ${userData.username}:`, error.message);
    }
  }

  console.log(`Created ${createdUsers.length} users`);

  console.log(`\nCreating ${data.tweets.length} tweets...`);
  let successCount = 0;

  // Create a map for username lookups
  const usernameToId = new Map(createdUsers.map((u) => [u.username.toLowerCase(), u.id]));

  // Store created tweets for quotes and replies
  const createdTweets: any[] = [];

  for (let i = 0; i < data.tweets.length; i++) {
    const tweetData = data.tweets[i];

    try {
      const user = createdUsers[tweetData.userIndex];

      if (!user) {
        console.error(`   ❌ Tweet ${i}: Invalid userIndex ${tweetData.userIndex}`);
        createdTweets.push(null);
        continue;
      }

      // Parse hashtags from content
      const hashtagsInContent = parseHashtags(tweetData.content);
      const allHashtags = [...new Set([...(tweetData.hashtags || []), ...hashtagsInContent])];

      // Parse mentions from content
      const mentionsInContent = parseMentions(tweetData.content);
      const allMentions = [...new Set([...(tweetData.mentions || []), ...mentionsInContent])];

      // Get or create hashtags
      const hashtagRecords = await Promise.all(allHashtags.map((tag) => getOrCreateHashtag(tag)));

      // Find mentioned user IDs
      const mentionedUserIds = allMentions
        .map((username) => usernameToId.get(username.toLowerCase()))
        .filter((id) => id !== undefined);

      const createdAt = calculateCreatedAt(
        tweetData.daysAgo,
        tweetData.hoursAgo,
        tweetData.minutesAgo,
      );

      // Handle quoted tweet reference
      let quotedTweetId = null;
      if (tweetData.quotedTweetIndex !== undefined && createdTweets[tweetData.quotedTweetIndex]) {
        quotedTweetId = createdTweets[tweetData.quotedTweetIndex].id;
      }

      // Handle reply reference
      let replyToTweetId = null;
      let rootTweetId = null;
      if (tweetData.replyToTweetIndex !== undefined && createdTweets[tweetData.replyToTweetIndex]) {
        const replyToTweet = createdTweets[tweetData.replyToTweetIndex];
        replyToTweetId = replyToTweet.id;
        rootTweetId = replyToTweet.rootTweetId || replyToTweet.id;
      }

      // Create media records if present
      const mediaRecords = [];
      if (tweetData.media && tweetData.media.length > 0) {
        for (const mediaData of tweetData.media) {
          const media = await prisma.media.create({
            data: {
              userId: user.id,
              type: mediaData.type,
              url: mediaData.url,
              width: mediaData.width || null,
              height: mediaData.height || null,
              altText: mediaData.altText || null,
              pending: false,
            },
          });
          mediaRecords.push(media);
        }
      }

      const tweet = await prisma.tweet.create({
        data: {
          userId: user.id,
          content: tweetData.content,
          class: tweetData.category,
          hasHashtags: hashtagRecords.length > 0,
          hasMentions: mentionedUserIds.length > 0,
          hasMedia: mediaRecords.length > 0,
          quotedTweetId,
          replyToTweetId,
          rootTweetId,
          createdAt,
          tweetHashtags: {
            create: hashtagRecords.map((hashtag, idx) => {
              const hashtagText = `#${allHashtags[idx]}`;
              const startPosition = tweetData.content.indexOf(hashtagText);
              return {
                hashtagId: hashtag.id,
                startPosition: startPosition >= 0 ? startPosition : 0,
              };
            }),
          },
          tweetMentions: {
            create: mentionedUserIds.map((userId, idx) => {
              const mentionText = `@${allMentions[idx]}`;
              const startPosition = tweetData.content.indexOf(mentionText);
              return {
                userId,
                startPosition: startPosition >= 0 ? startPosition : 0,
              };
            }),
          },
          tweetMedia: {
            create: mediaRecords.map((media, idx) => ({
              mediaId: media.id,
              order: idx,
            })),
          },
        },
      });

      createdTweets.push(tweet);
      successCount++;

      if ((i + 1) % 500 === 0) {
        console.log(`  Created ${i + 1}/${data.tweets.length} tweets`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to create tweet ${i}:`, error.message);
      createdTweets.push(null);
    }
  }

  console.log(`Created ${successCount} tweets`);

  // Create retweets if present
  if (data.retweets && data.retweets.length > 0) {
    console.log(`\n Creating ${data.retweets.length} retweets...`);
    let retweetCount = 0;

    for (const retweetData of data.retweets) {
      try {
        const user = createdUsers[retweetData.userIndex];
        const tweet = createdTweets[retweetData.tweetIndex];

        if (!user || !tweet) {
          console.error(
            `   ❌ Invalid retweet reference: user ${retweetData.userIndex}, tweet ${retweetData.tweetIndex}`,
          );
          continue;
        }

        const createdAt = calculateCreatedAt(
          retweetData.daysAgo,
          retweetData.hoursAgo,
          retweetData.minutesAgo,
        );

        await prisma.retweet.create({
          data: {
            userId: user.id,
            tweetId: tweet.id,
            createdAt,
          },
        });

        // Update retweet count on the tweet
        await prisma.tweet.update({
          where: { id: tweet.id },
          data: { retweetCount: { increment: 1 } },
        });

        retweetCount++;
      } catch (error) {
        console.error(`   ❌ Failed to create retweet:`, error.message);
      }
    }

    console.log(`Created ${retweetCount} retweets`);
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

  const retweetCount = data.retweets?.length || 0;
  const mediaCount = await prisma.media.count();
  const quotedCount = await prisma.tweet.count({ where: { quotedTweetId: { not: null } } });
  const replyCount = await prisma.tweet.count({ where: { replyToTweetId: { not: null } } });

  console.log('\nDatabase seeded successfully!');
  console.log(`   Users: ${createdUsers.length}`);
  console.log(`   Tweets: ${successCount}`);
  console.log(`   Retweets: ${retweetCount}`);
  console.log(`   Replies: ${replyCount}`);
  console.log(`   Quotes: ${quotedCount}`);
  console.log(`   Media: ${mediaCount}`);
  console.log(`   Follows: ${uniqueFollows.length}`);
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
