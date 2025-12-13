import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/utils/password.util';

const prisma = new PrismaClient();

async function getOrCreateHashtag(tag: string) {
  const keyword = tag.toLowerCase();

  // Create hashtag in hashtags table for tweet linking
  const hashtag = await prisma.hashtag.upsert({
    where: {
      keyword,
    },
    update: {},
    create: {
      keyword,
    },
  });

  // Also create/increment in trending_keywords for scoring
  // this uses trending_keywords
  await prisma.trendingKeyword.upsert({
    where: {
      keyword_isHashtag: {
        keyword,
        isHashtag: true,
      },
    },
    update: {
      count: { increment: 1 },
    },
    create: {
      keyword,
      isHashtag: true,
      count: 1,
    },
  });

  return hashtag;
}

async function main() {
  // Step 1: Clean slate for this specific seed's data.
  await prisma.tweetHashtag.deleteMany({});
  await prisma.tweetMention.deleteMany({});
  await prisma.like.deleteMany({});
  await prisma.retweet.deleteMany({});
  await prisma.tweet.deleteMany({});
  await prisma.follow.deleteMany({});
  await prisma.hashtag.deleteMany({});
  await prisma.trendingKeyword.deleteMany({});

  // Step 2: Create the 5 specified user accounts.
  const password = await hashPassword('Password1$');

  const omarHassan = await prisma.user.create({
    data: {
      username: 'omarhassan',
      email: 'omar.hassan@dev.com',
      passwordHash: password,
      birthdate: new Date('2003-08-04'),
      profile: { create: { displayName: 'Omar Hassan' } },
    },
  });

  const omarGamal = await prisma.user.create({
    data: {
      username: 'notnowomar',
      email: 'omar.gamal@dev.com',
      passwordHash: password,
      birthdate: new Date('2003-12-04'),
      profile: { create: { displayName: 'Omar Gamal' } },
    },
  });

  const mostafa = await prisma.user.create({
    data: {
      username: 'mostafa_g',
      email: 'mostafa.g@dev.com',
      passwordHash: password,
      birthdate: new Date('2003-12-05'),
      profile: { create: { displayName: 'Mostafa Gelgel' } },
    },
  });

  const anas = await prisma.user.create({
    data: {
      username: 'anas_ibrahim',
      email: 'anas.ibrahim@dev.com',
      passwordHash: password,
      birthdate: new Date('2004-01-10'),
      profile: { create: { displayName: 'Anas Ibrahim' } },
    },
  });

  const tasneem = await prisma.user.create({
    data: {
      username: 'tasneem_m',
      email: 'tasneem.a@dev.com',
      passwordHash: password,
      birthdate: new Date('2004-08-04'),
      profile: { create: { displayName: 'Tasneem Mohamed' } },
    },
  });

  const loay = await prisma.user.create({
    data: {
      username: 'loayahmed',
      email: 'loay.ahmed@dev.com',
      passwordHash: password,
      birthdate: new Date('2004-08-04'),
      profile: { create: { displayName: 'Loay Ahmed' } },
    },
  });

  // Step 3: Create a network where everyone follows each other.
  const allUsers = [omarHassan, omarGamal, mostafa, anas, tasneem, loay];
  const followData = [];
  for (const follower of allUsers) {
    for (const followed of allUsers) {
      if (follower.id !== followed.id) {
        followData.push({ followerId: follower.id, followedId: followed.id });
      }
    }
  }
  await prisma.follow.createMany({ data: followData });

  // Step 4: Prepare hashtags that will be used in the tweets.
  const nestjsHashtag = await getOrCreateHashtag('nestjs');
  const devlifeHashtag = await getOrCreateHashtag('devlife');
  const uidesignHashtag = await getOrCreateHashtag('uidesign');
  const launchdayHashtag = await getOrCreateHashtag('launchday');
  const bugfixHashtag = await getOrCreateHashtag('bugfix');
  const speedHashtag = await getOrCreateHashtag('ishowspeed');

  // Step 5: Create a rich set of over 20 tweets with staggered timestamps.
  const baseTime = Date.now();

  // A series of tweets telling a story about a project launch.
  await prisma.tweet.create({
    data: {
      userId: tasneem.id,
      content:
        'Final UI mockups for the new feature are ready! So excited to see this go live. #uidesign',
      createdAt: new Date(baseTime - 1000 * 60 * 120), // 2 hours ago
      hasHashtags: true,
      tweetHashtags: { create: { hashtagId: uidesignHashtag.id, startPosition: 80 } },
    },
  });

  const anasLaunchTweet = await prisma.tweet.create({
    data: {
      userId: anas.id,
      content:
        'Alright team, the final build is deploying to production now! Wish us luck! #launchday @omarhassan',
      createdAt: new Date(baseTime - 1000 * 60 * 90), // 90 mins ago
      hasHashtags: true,
      hasMentions: true,
      tweetHashtags: { create: { hashtagId: launchdayHashtag.id, startPosition: 76 } },
      tweetMentions: { create: { userId: omarHassan.id, startPosition: 87 } },
    },
  });

  await prisma.tweet.create({
    data: {
      userId: omarHassan.id,
      content:
        'Deployment successful! I am monitoring the logs now. Great work everyone, especially @anas_ibrahim!',
      replyToTweetId: anasLaunchTweet.id,
      createdAt: new Date(baseTime - 1000 * 60 * 88), // 88 mins ago
      hasMentions: true,
      tweetMentions: { create: { userId: anas.id, startPosition: 85 } },
    },
  });

  const mostafaDevlifeTweet = await prisma.tweet.create({
    data: {
      userId: mostafa.id,
      content:
        'That feeling when the production build works on the first try. A rare moment. #devlife',
      createdAt: new Date(baseTime - 1000 * 60 * 85), // 85 mins ago
      hasHashtags: true,
      tweetHashtags: { create: { hashtagId: devlifeHashtag.id, startPosition: 78 } },
    },
  });

  // A new thread starts: a bug is found.
  const tasneemBugTweet = await prisma.tweet.create({
    data: {
      userId: tasneem.id,
      content:
        'Uh oh... I think I found a small CSS bug on the new login page. The main button is misaligned on mobile. @omargamal',
      createdAt: new Date(baseTime - 1000 * 60 * 60), // 60 mins ago
      hasMentions: true,
      tweetMentions: { create: { userId: omarGamal.id, startPosition: 105 } },
    },
  });

  await prisma.tweet.create({
    data: {
      userId: omarGamal.id,
      content: 'let the goofy frontenders fix it',
      quotedTweetId: tasneemBugTweet.id, // Quote Tweet
      createdAt: new Date(baseTime - 1000 * 60 * 50), // 50 mins ago
    },
  });

  await prisma.tweet.create({
    data: {
      userId: omarGamal.id,
      content: 'On it! Thanks for the catch @tasneem_a. Pushing a hotfix now. #bugfix',
      replyToTweetId: tasneemBugTweet.id,
      createdAt: new Date(baseTime - 1000 * 60 * 58), // 58 mins ago
      hasHashtags: true,
      hasMentions: true,
      tweetHashtags: { create: { hashtagId: bugfixHashtag.id, startPosition: 62 } },
      tweetMentions: { create: { userId: tasneem.id, startPosition: 28 } },
    },
  });

  // More standalone tweets to fill the timeline

  const omarStreamTweet = await prisma.tweet.create({
    data: {
      userId: omarGamal.id,
      content:
        "can't wait to wakeup tomorrow and watch #ishowspeed stream, we should donate bro @loayahmed",
      createdAt: new Date(baseTime - 1000 * 60 * 85), // 85 mins ago
      hasHashtags: true,
      hasMentions: true,
      tweetHashtags: { create: { hashtagId: speedHashtag.id, startPosition: 40 } },
      tweetMentions: { create: { userId: loay.id, startPosition: 81 } },
    },
  });

  await prisma.like.create({
    data: {
      userId: omarGamal.id,
      tweetId: mostafaDevlifeTweet.id,
    },
  });

  await prisma.tweet.update({
    where: { id: mostafaDevlifeTweet.id },
    data: { likeCount: { increment: 1 } },
  });

  await prisma.retweet.create({
    data: {
      userId: omarGamal.id,
      tweetId: mostafaDevlifeTweet.id,
    },
  });

  await prisma.retweet.create({
    data: {
      userId: omarHassan.id,
      tweetId: mostafaDevlifeTweet.id,
    },
  });

  await prisma.tweet.update({
    where: { id: mostafaDevlifeTweet.id },
    data: { retweetCount: { increment: 2 } },
  });

  await prisma.tweet.create({
    data: {
      userId: omarHassan.id,
      content: "This is so hilarious that I'm gonna quote it lmao",
      createdAt: new Date(baseTime - 1000 * 60 * 70), // 70 mins ago
      hasHashtags: true,
      hasMentions: true,
      quotedTweetId: omarStreamTweet.id,
    },
  });

  await prisma.tweet.create({
    data: {
      userId: loay.id,
      content: 'broooooo yes lets gooo @notnowomar',
      replyToTweetId: omarStreamTweet.id,
      createdAt: new Date(baseTime - 1000 * 60 * 80), // 80 mins ago
      hasMentions: true,
      tweetMentions: { create: { userId: omarGamal.id, startPosition: 23 } },
    },
  });

  await prisma.tweet.create({
    data: {
      userId: anas.id,
      content: 'Time for a break. Anyone up for a game later?',
      createdAt: new Date(baseTime - 1000 * 60 * 45),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: mostafa.id,
      content:
        'Just learned about Prisma Accelerate, this could be a game changer for our database performance.',
      createdAt: new Date(baseTime - 1000 * 60 * 40),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: omarHassan.id,
      content: 'The #nestjs architecture is really paying off. Adding new features is so fast.',
      createdAt: new Date(baseTime - 1000 * 60 * 35),
      hasHashtags: true,
      tweetHashtags: {
        create: { hashtagId: nestjsHashtag.id, startPosition: 4 },
      },
    },
  });
  await prisma.tweet.create({
    data: {
      userId: tasneem.id,
      content: 'Thinking about our next feature sprint. What should we prioritize?',
      createdAt: new Date(baseTime - 1000 * 60 * 30),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: omarGamal.id,
      content: 'I vote for implementing the direct messaging feature.',
      createdAt: new Date(baseTime - 1000 * 60 * 28),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: anas.id,
      content: 'Seconded! I can start on the frontend for DMs next week.',
      createdAt: new Date(baseTime - 1000 * 60 * 25),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: mostafa.id,
      content: 'The server is running smoothly after the launch. Feels good.',
      createdAt: new Date(baseTime - 1000 * 60 * 20),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: omarHassan.id,
      content: 'Agreed. Solid teamwork all around.',
      createdAt: new Date(baseTime - 1000 * 60 * 18),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: tasneem.id,
      content: 'Weekend plans?',
      createdAt: new Date(baseTime - 1000 * 60 * 15),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: anas.id,
      content: 'Definitely sleeping in.',
      createdAt: new Date(baseTime - 1000 * 60 * 12),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: omarGamal.id,
      content: 'Exploring some new VS Code extensions.',
      createdAt: new Date(baseTime - 1000 * 60 * 10),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: mostafa.id,
      content: 'Might finally read that book on system design.',
      createdAt: new Date(baseTime - 1000 * 60 * 8),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: omarHassan.id,
      content: 'Just trying to relax before the next sprint begins!',
      createdAt: new Date(baseTime - 1000 * 60 * 5),
    },
  });
  await prisma.tweet.create({
    data: {
      userId: tasneem.id,
      content: 'Have a great weekend everyone!',
      createdAt: new Date(baseTime - 1000 * 60 * 2),
    },
  });
}

main()
  .catch(() => {
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
