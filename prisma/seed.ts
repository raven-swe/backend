import { PrismaClient, NotificationType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  await prisma.tweet.updateMany({
    data: { quotedTweetId: null, replyToTweetId: null },
  });
  await prisma.conversation.updateMany({
    data: { lastMessageId: null },
  });
  await prisma.conversationParticipant.updateMany({
    data: { lastSeenMessageId: null },
  });
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
  await prisma.tweetMention.deleteMany();
  await prisma.tweet.deleteMany();
  await prisma.mute.deleteMany();
  await prisma.block.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.userDevice.deleteMany();
  await prisma.userExternalAccount.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.country.deleteMany();

  await prisma.$executeRaw`ALTER SEQUENCE "users_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "refresh_tokens_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "user_devices_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "tweets_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "trending_keywords_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "messages_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "conversations_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "notifications_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "media_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "countries_id_seq" RESTART WITH 1;`;

  const countriesPath = path.join(__dirname, 'countries.json');
  const countriesData = JSON.parse(fs.readFileSync(countriesPath, 'utf-8')) as Array<{
    name: string;
    'alpha-2': string;
    'country-code': string;
  }>;

  for (const country of countriesData) {
    await prisma.country.create({
      data: {
        name: country.name,
        code: country['alpha-2'],
      },
    });
  }

  const egypt = await prisma.country.findFirst({ where: { code: 'EG' } });
  const usa = await prisma.country.findFirst({ where: { code: 'US' } });
  const uk = await prisma.country.findFirst({ where: { code: 'GB' } });
  const canada = await prisma.country.findFirst({ where: { code: 'CA' } });
  const germany = await prisma.country.findFirst({ where: { code: 'DE' } });
  const france = await prisma.country.findFirst({ where: { code: 'FR' } });

  const usersToCreate = [
    {
      username: 'OmarHassan',
      email: 'omar@gmail.com',
      passwordHash: '$2a$10$skJLBvUxlf0KBnUGNAG0BuDb.v6mUbKgGlVfWaTEsHNJtk00qvBNS',
      birthdate: new Date('2003-08-04'),
      countryId: egypt?.id,
      profile: { create: { displayName: 'Omar Hassan' } },
    },
    {
      username: 'notnowomar',
      email: 'omarg@gmail.com',
      passwordHash: '$2a$10$OQw7ZoP7SETenCXbALgfD.eAKegNI0FUMwpqpPS977X017JaMG6dC',
      birthdate: new Date('2003-12-04'),
      countryId: egypt?.id,
      profile: {
        create: {
          displayName: 'Omar Gamal',
          bio: 'Frontend enthusiast.',
          location: 'Alexandria, Egypt',
        },
      },
    },
    {
      username: 'Tasneem',
      email: 'tasneem@gmail.com',
      passwordHash: '$2a$10$SAgbBSiZOk8LW/9IaD2PzOtlQi39JWaLLkmRrTobcLWqZIRoNptYu',
      birthdate: new Date('2004-08-04'),
      phone: '01001013205',
      countryId: egypt?.id,
      profile: { create: { displayName: 'Tasneem', bio: 'Life is good.' } },
    },
    {
      username: 'anasbrahim',
      email: 'anas@gmail.com',
      passwordHash: '$2a$10$F.6W9pCnJ9PNq1X7ExOZ1OcF1RIke/nqVxCUbgi.FDl.jrCBdC7wq',
      birthdate: new Date('2004-08-04'),
      phone: '01005013203',
      countryId: egypt?.id,
      profile: { create: { displayName: 'Anas' } },
    },
    {
      username: 'gelgel',
      email: 'mostafa@gmail.com',
      passwordHash: '$2a$10$QHBO7om6Al91AXUn7kzVf.ftg3fMhQBDUAKUn5q7X3ymjmT5f68R2',
      birthdate: new Date('2003-12-05'),
      phone: '01005013209',
      countryId: egypt?.id,
      profile: { create: { displayName: 'Mostafa' } },
    },
    {
      username: 'Layla',
      email: 'layla@gmail.com',
      passwordHash: '$2a$10$bE.9Z9.E1c.g2k4Z3H1fO.B5n1X2w3V4u5s6t7y8Z9A0B1c2d3E4',
      birthdate: new Date('2002-05-15'),
      countryId: usa?.id,
      profile: { create: { displayName: 'Layla El-Sayed', bio: 'Designer & Photographer 📸' } },
    },
    {
      username: 'kimo',
      email: 'karim@gmail.com',
      passwordHash: '$2a$10$fG.8h7j6K5L4M3N2P1q0R.o9s8d7f6g5h4j3k2l1I0E9F8d7c6b5',
      birthdate: new Date('2003-11-20'),
      countryId: uk?.id,
      profile: { create: { displayName: 'karim', bio: 'Just here for the memes.' } },
    },
    {
      username: 'SaraA',
      email: 'sara@gmail.com',
      passwordHash: '$2a$10$aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789AbCdEfGhIjKlMnOp',
      birthdate: new Date('2001-03-10'),
      phone: '01001234567',
      countryId: canada?.id,
      profile: { create: { displayName: 'Sara Ahmed', bio: 'Backend dev & coffee addict ☕' } },
    },
    {
      username: 'ZakiDev',
      email: 'ahmedz@gmail.com',
      passwordHash: '$2a$10$QrStUvWxYz0123456789AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      birthdate: new Date('2004-07-22'),
      countryId: germany?.id,
      profile: { create: { displayName: 'Ahmed Zaki', bio: 'Learning GraphQL daily.' } },
    },
    {
      username: 'NourCodes',
      email: 'nour@gmail.com',
      passwordHash: '$2a$10$1234567890AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfG',
      birthdate: new Date('2002-09-18'),
      countryId: france?.id,
      profile: { create: { displayName: 'Nour', bio: 'Full-stack explorer.' } },
    },
    {
      username: 'YoussefTech',
      email: 'youssef@gmail.com',
      passwordHash: '$2a$10$hIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIjKlMnOpQrStUvW',
      birthdate: new Date('2003-02-14'),
      phone: '01009876543',
      countryId: egypt?.id,
      profile: { create: { displayName: 'Youssef', bio: 'AI enthusiast 🤖' } },
    },
    {
      username: 'FatmaDesign',
      email: 'fatma@gmail.com',
      passwordHash: '$2a$10$xYz0123456789AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCd',
      birthdate: new Date('2004-11-30'),
      countryId: usa?.id,
      profile: { create: { displayName: 'Fatma', bio: 'UI/UX magic maker.' } },
    },
  ];
  for (const user of usersToCreate) {
    await prisma.user.create({ data: user });
  }

  await prisma.follow.createMany({
    data: [
      { followerId: 1, followedId: 2, withNotifications: true },
      { followerId: 1, followedId: 4 },
      { followerId: 1, followedId: 6 },
      { followerId: 1, followedId: 8 },
      { followerId: 1, followedId: 10 },
      { followerId: 2, followedId: 1 },
      { followerId: 2, followedId: 3 },
      { followerId: 2, followedId: 4 },
      { followerId: 2, followedId: 9 },
      { followerId: 3, followedId: 2 },
      { followerId: 3, followedId: 6 },
      { followerId: 3, followedId: 11 },
      { followerId: 4, followedId: 1 },
      { followerId: 4, followedId: 2 },
      { followerId: 4, followedId: 5 },
      { followerId: 4, followedId: 12 },
      { followerId: 5, followedId: 4 },
      { followerId: 5, followedId: 7 },
      { followerId: 5, followedId: 8 },
      { followerId: 6, followedId: 1 },
      { followerId: 6, followedId: 3 },
      { followerId: 6, followedId: 10 },
      { followerId: 7, followedId: 2 },
      { followerId: 7, followedId: 5 },
      { followerId: 7, followedId: 9 },
      { followerId: 8, followedId: 1, withNotifications: true },
      { followerId: 8, followedId: 4 },
      { followerId: 8, followedId: 6 },
      { followerId: 9, followedId: 2 },
      { followerId: 9, followedId: 7 },
      { followerId: 10, followedId: 1 },
      { followerId: 10, followedId: 6 },
      { followerId: 11, followedId: 3 },
      { followerId: 11, followedId: 4 },
      { followerId: 12, followedId: 6 },
      { followerId: 12, followedId: 8 },
    ],
  });

  await prisma.block.createMany({
    data: [
      { userId: 3, blockedId: 5 },
      { userId: 7, blockedId: 11 },
      { userId: 9, blockedId: 12 },
    ],
  });

  await prisma.mute.createMany({
    data: [
      { userId: 1, mutedId: 7 },
      { userId: 6, mutedId: 10 },
      { userId: 4, mutedId: 2 },
    ],
  });

  const getHashtag = async (tag: string) => {
    return prisma.trendingKeyword.upsert({
      where: { keyword_isHashtag: { keyword: tag, isHashtag: true } },
      update: { count: { increment: 1 } },
      create: { keyword: tag, isHashtag: true, count: 1 },
    });
  };

  let tsHashtag = await getHashtag('typescript');
  const nestHashtag = await getHashtag('nestjs');
  const authHashtag = await getHashtag('auth');

  const anasTweet1 = await prisma.tweet.create({
    data: {
      userId: 4,
      content:
        'Just deployed my first app with #nestjs. The developer experience is amazing compared to Express. #typescript @OmarHassan what do you think?',
      hasHashtags: true,
      hasMentions: true,
      tweetHashtags: {
        create: [
          { hashtagId: nestHashtag.id, startingIndex: 31 },
          { hashtagId: tsHashtag.id, startingIndex: 88 },
        ],
      },
      tweetMentions: {
        create: [{ userId: 1, startingIndex: 118 }],
      },
    },
  });

  const omarGReply1 = await prisma.tweet.create({
    data: {
      userId: 2,
      content: 'Totally agree! The module system keeps everything so clean. @anasbrahim',
      replyToTweetId: anasTweet1.id,
      hasMentions: true,
      tweetMentions: {
        create: [{ userId: 4, startingIndex: 65 }],
      },
    },
  });

  const omarHReply1 = await prisma.tweet.create({
    data: {
      userId: 1,
      content: 'How are you handling authentication? Passport.js strategies? #auth',
      replyToTweetId: anasTweet1.id,
      hasHashtags: true,
      tweetHashtags: {
        create: [{ hashtagId: authHashtag.id, startingIndex: 72 }],
      },
    },
  });

  const anasReply2 = await prisma.tweet.create({
    data: {
      userId: 4,
      content: 'Yep, using passport-jwt. It integrated surprisingly easily. Thanks @OmarHassan!',
      replyToTweetId: omarHReply1.id,
      hasMentions: true,
      tweetMentions: {
        create: [{ userId: 1, startingIndex: 52 }],
      },
    },
  });

  const saraReply1 = await prisma.tweet.create({
    data: {
      userId: 8,
      content: 'Loving this thread! For scalable auth, consider JWT with refresh tokens.',
      replyToTweetId: anasTweet1.id,
    },
  });

  const foodHashtag = await getHashtag('foodie');
  const cairoHashtag = await getHashtag('cairo');
  const egyptHashtag = await getHashtag('egypt');

  const laylaTweet1 = await prisma.tweet.create({
    data: {
      userId: 6,
      content:
        'Found the best koshary place in downtown #cairo! Must-visit for every #foodie in #egypt 🤤 @Tasneem',
      hasMedia: true,
      hasHashtags: true,
      hasMentions: true,
      tweetHashtags: {
        create: [
          { hashtagId: cairoHashtag.id, startingIndex: 41 },
          { hashtagId: foodHashtag.id, startingIndex: 64 },
          { hashtagId: egyptHashtag.id, startingIndex: 78 },
        ],
      },
      tweetMentions: {
        create: [{ userId: 3, startingIndex: 92 }],
      },
    },
  });

  const tasneemReply1 = await prisma.tweet.create({
    data: {
      userId: 3,
      content: 'Omg where is this?? Looks incredible! @Layla tag me next time!',
      replyToTweetId: laylaTweet1.id,
      hasMentions: true,
      tweetMentions: {
        create: [{ userId: 6, startingIndex: 40 }],
      },
    },
  });

  const fatmaReply1 = await prisma.tweet.create({
    data: {
      userId: 12,
      content: 'Koshary is life! Adding to my list. 😍',
      replyToTweetId: laylaTweet1.id,
    },
  });

  const memeHashtag = await getHashtag('memes');
  const internetHashtag = await getHashtag('internet');

  const karimTweet1 = await prisma.tweet.create({
    data: {
      userId: 7,
      content: 'Is it just me or is the #internet extra slow today? Share your pain! #memes',
      hasHashtags: true,
      tweetHashtags: {
        create: [
          { hashtagId: internetHashtag.id, startingIndex: 25 },
          { hashtagId: memeHashtag.id, startingIndex: 58 },
        ],
      },
    },
  });

  const gelgelQuoteTweet = await prisma.tweet.create({
    data: {
      userId: 5,
      content: 'Definitely not just you. My downloads are crawling. @Kimo this is your fault! 😂',
      quotedTweetId: karimTweet1.id,
      hasMentions: true,
      tweetMentions: {
        create: [{ userId: 7, startingIndex: 58 }],
      },
    },
  });

  const youssefReply1 = await prisma.tweet.create({
    data: {
      userId: 11,
      content: 'ISP woes unite us all. Time for Starlink? 🚀',
      replyToTweetId: karimTweet1.id,
    },
  });

  const uiuxHashtag = await getHashtag('uiux');
  const designHashtag = await getHashtag('design');
  tsHashtag = await getHashtag('typescript');

  const fatmaTweet1 = await prisma.tweet.create({
    data: {
      userId: 12,
      content:
        'Quick tip for better #uiux: Always test with real users. What’s your go-to tool? #design #typescript @ZakiDev',
      hasHashtags: true,
      hasMentions: true,
      tweetHashtags: {
        create: [
          { hashtagId: uiuxHashtag.id, startingIndex: 22 },
          { hashtagId: designHashtag.id, startingIndex: 60 },
          { hashtagId: tsHashtag.id, startingIndex: 67 },
        ],
      },
      tweetMentions: {
        create: [{ userId: 9, startingIndex: 74 }],
      },
    },
  });

  const ahmedZReply1 = await prisma.tweet.create({
    data: {
      userId: 9,
      content: 'Figma all the way, but user testing is overrated sometimes. @FatmaDesign',
      replyToTweetId: fatmaTweet1.id,
      hasMentions: true,
      tweetMentions: {
        create: [{ userId: 12, startingIndex: 52 }],
      },
    },
  });

  const aiHashtag = await getHashtag('ai');

  const youssefTweet1 = await prisma.tweet.create({
    data: {
      userId: 11,
      content: 'AI is changing everything. Excited for the future! #ai @YoussefTech self-promo 😏',
      hasHashtags: true,
      tweetHashtags: {
        create: [{ hashtagId: aiHashtag.id, startingIndex: 38 }],
      },
    },
  });

  const graphqlHashtag = await getHashtag('graphql');

  const nourTweet1 = await prisma.tweet.create({
    data: {
      userId: 10,
      content: 'Diving deep into #graphql today. Resolvers got me hooked! @NourCodes',
      hasHashtags: true,
      tweetHashtags: {
        create: [{ hashtagId: graphqlHashtag.id, startingIndex: 15 }],
      },
    },
  });

  await prisma.like.createMany({
    data: [
      { userId: 1, tweetId: anasTweet1.id },
      { userId: 2, tweetId: anasTweet1.id },
      { userId: 5, tweetId: anasTweet1.id },
      { userId: 8, tweetId: anasTweet1.id },
      { userId: 4, tweetId: omarGReply1.id },
      { userId: 1, tweetId: omarGReply1.id },
      { userId: 10, tweetId: omarHReply1.id },
      { userId: 4, tweetId: anasReply2.id },
      { userId: 1, tweetId: anasReply2.id },
      { userId: 8, tweetId: saraReply1.id },
      { userId: 1, tweetId: laylaTweet1.id },
      { userId: 2, tweetId: laylaTweet1.id },
      { userId: 3, tweetId: laylaTweet1.id },
      { userId: 7, tweetId: laylaTweet1.id },
      { userId: 4, tweetId: tasneemReply1.id },
      { userId: 6, tweetId: tasneemReply1.id },
      { userId: 12, tweetId: fatmaReply1.id },
      { userId: 2, tweetId: karimTweet1.id },
      { userId: 4, tweetId: karimTweet1.id },
      { userId: 5, tweetId: karimTweet1.id },
      { userId: 9, tweetId: karimTweet1.id },
      { userId: 7, tweetId: gelgelQuoteTweet.id },
      { userId: 3, tweetId: youssefReply1.id },
      { userId: 6, tweetId: fatmaTweet1.id },
      { userId: 1, tweetId: fatmaTweet1.id },
      { userId: 9, tweetId: ahmedZReply1.id },
      { userId: 12, tweetId: ahmedZReply1.id },
      { userId: 2, tweetId: youssefTweet1.id },
      { userId: 8, tweetId: youssefTweet1.id },
      { userId: 4, tweetId: nourTweet1.id },
      { userId: 11, tweetId: nourTweet1.id },
    ],
  });

  await prisma.retweet.createMany({
    data: [
      { userId: 2, tweetId: laylaTweet1.id },
      { userId: 3, tweetId: anasTweet1.id },
      { userId: 8, tweetId: anasTweet1.id },
      { userId: 5, tweetId: karimTweet1.id },
      { userId: 10, tweetId: fatmaTweet1.id },
    ],
  });

  await prisma.tweet.updateMany({
    where: {
      id: { in: [anasTweet1.id, omarGReply1.id, omarHReply1.id, anasReply2.id, saraReply1.id] },
    },
    data: { likeCount: { increment: 1 } },
  });
  await prisma.tweet.update({
    where: { id: anasTweet1.id },
    data: { likeCount: 4, retweetCount: 2, replyCount: 4 },
  });
  await prisma.tweet.update({
    where: { id: omarGReply1.id },
    data: { likeCount: 2, replyCount: 0 },
  });
  await prisma.tweet.update({
    where: { id: omarHReply1.id },
    data: { likeCount: 1, replyCount: 1 },
  });
  await prisma.tweet.update({ where: { id: anasReply2.id }, data: { likeCount: 2 } });
  await prisma.tweet.update({ where: { id: saraReply1.id }, data: { likeCount: 1 } });
  await prisma.tweet.update({
    where: { id: laylaTweet1.id },
    data: { likeCount: 4, retweetCount: 1, replyCount: 2 },
  });
  await prisma.tweet.update({ where: { id: tasneemReply1.id }, data: { likeCount: 2 } });
  await prisma.tweet.update({ where: { id: fatmaReply1.id }, data: { likeCount: 1 } });
  await prisma.tweet.update({
    where: { id: karimTweet1.id },
    data: { likeCount: 4, retweetCount: 1 },
  });
  await prisma.tweet.update({ where: { id: gelgelQuoteTweet.id }, data: { likeCount: 1 } });
  await prisma.tweet.update({ where: { id: youssefReply1.id }, data: { likeCount: 1 } });
  await prisma.tweet.update({
    where: { id: fatmaTweet1.id },
    data: { likeCount: 2, replyCount: 1 },
  });
  await prisma.tweet.update({ where: { id: ahmedZReply1.id }, data: { likeCount: 2 } });
  await prisma.tweet.update({ where: { id: youssefTweet1.id }, data: { likeCount: 2 } });
  await prisma.tweet.update({ where: { id: nourTweet1.id }, data: { likeCount: 2 } });

  const groupConversation1 = await prisma.conversation.create({
    data: {
      conversationParticipants: {
        create: [
          { userId: 4, notificationsMuted: false },
          { userId: 1, notificationsMuted: true },
          { userId: 2, lastSeenMessageId: null },
        ],
      },
    },
  });

  await prisma.message.create({
    data: {
      content: 'Hey guys, thinking of making that NestJS project open source.',
      conversationId: groupConversation1.id,
      userId: 4,
      messageEntities: { text: 'Hey guys, thinking of making that NestJS project open source.' },
    },
  });
  await prisma.message.create({
    data: {
      content: 'Great idea! I can help with the database schema design.',
      conversationId: groupConversation1.id,
      userId: 1,
      messageEntities: { text: 'Great idea! I can help with the database schema design.' },
    },
  });
  const msg1_3 = await prisma.message.create({
    data: {
      content: "I'm in! I can set up the frontend with React/Next.js.",
      conversationId: groupConversation1.id,
      userId: 2,
      messageEntities: { text: "I'm in! I can set up the frontend with React/Next.js." },
    },
  });

  await prisma.conversation.update({
    where: { id: groupConversation1.id },
    data: { lastMessageId: msg1_3.id },
  });

  const privateConv1 = await prisma.conversation.create({
    data: {
      conversationParticipants: {
        create: [{ userId: 6 }, { userId: 3, lastSeenMessageId: null }],
      },
    },
  });

  const privMsg1 = await prisma.message.create({
    data: {
      content: "Tasneem, that koshary spot is at Abou Tarek! Let's go this weekend?",
      conversationId: privateConv1.id,
      userId: 6,
      messageEntities: {
        text: "Tasneem, that koshary spot is at Abou Tarek! Let's go this weekend?",
      },
    },
  });

  await prisma.conversation.update({
    where: { id: privateConv1.id },
    data: { lastMessageId: privMsg1.id },
  });

  const groupConversation2 = await prisma.conversation.create({
    data: {
      conversationParticipants: {
        create: [{ userId: 8 }, { userId: 12, notificationsMuted: false }, { userId: 9 }],
      },
    },
  });

  await prisma.message.create({
    data: {
      content: 'Team, ideas for the new app redesign?',
      conversationId: groupConversation2.id,
      userId: 8,
      messageEntities: { text: 'Team, ideas for the new app redesign?' },
    },
  });
  const msg2_2 = await prisma.message.create({
    data: {
      content: 'I vote for more intuitive nav. Thoughts @ZakiDev?',
      conversationId: groupConversation2.id,
      userId: 12,
      messageEntities: {
        text: 'I vote for more intuitive nav. Thoughts @ZakiDev?',
        mentions: [
          {
            name: '@ZakiDev',
            startingIndex: '41',
          },
        ],
      },
    },
  });

  await prisma.conversation.update({
    where: { id: groupConversation2.id },
    data: { lastMessageId: msg2_2.id },
  });

  await prisma.notification.createMany({
    data: [
      { actorId: 1, receiverId: 2, type: NotificationType.FOLLOW, seen: true },
      { actorId: 1, receiverId: 4, type: NotificationType.FOLLOW },
      { actorId: 1, receiverId: 6, type: NotificationType.FOLLOW },
      { actorId: 1, receiverId: 8, type: NotificationType.FOLLOW },
      { actorId: 2, receiverId: 1, type: NotificationType.FOLLOW },
      { actorId: 2, receiverId: 3, type: NotificationType.FOLLOW },
      { actorId: 2, receiverId: 4, type: NotificationType.FOLLOW },
      { actorId: 2, receiverId: 9, type: NotificationType.FOLLOW },
      { actorId: 3, receiverId: 2, type: NotificationType.FOLLOW },
      { actorId: 3, receiverId: 6, type: NotificationType.FOLLOW },
      { actorId: 3, receiverId: 11, type: NotificationType.FOLLOW },
      { actorId: 1, receiverId: 4, type: NotificationType.LIKE, tweetId: anasTweet1.id },
      { actorId: 2, receiverId: 4, type: NotificationType.LIKE, tweetId: anasTweet1.id },
      { actorId: 5, receiverId: 4, type: NotificationType.LIKE, tweetId: anasTweet1.id },
      { actorId: 8, receiverId: 4, type: NotificationType.LIKE, tweetId: anasTweet1.id },
      { actorId: 1, receiverId: 2, type: NotificationType.LIKE, tweetId: omarGReply1.id },
      { actorId: 4, receiverId: 2, type: NotificationType.LIKE, tweetId: omarGReply1.id },
      { actorId: 10, receiverId: 1, type: NotificationType.LIKE, tweetId: omarHReply1.id },
      { actorId: 1, receiverId: 6, type: NotificationType.LIKE, tweetId: laylaTweet1.id },
      { actorId: 3, receiverId: 6, type: NotificationType.LIKE, tweetId: laylaTweet1.id },
      { actorId: 7, receiverId: 6, type: NotificationType.LIKE, tweetId: laylaTweet1.id },
      { actorId: 2, receiverId: 4, type: NotificationType.REPLY, tweetId: omarGReply1.id },
      { actorId: 1, receiverId: 4, type: NotificationType.REPLY, tweetId: omarHReply1.id },
      { actorId: 4, receiverId: 1, type: NotificationType.REPLY, tweetId: anasReply2.id },
      { actorId: 8, receiverId: 4, type: NotificationType.REPLY, tweetId: saraReply1.id },
      { actorId: 3, receiverId: 6, type: NotificationType.REPLY, tweetId: tasneemReply1.id },
      { actorId: 12, receiverId: 6, type: NotificationType.REPLY, tweetId: fatmaReply1.id },
      { actorId: 1, receiverId: 4, type: NotificationType.MENTION, tweetId: anasTweet1.id },
      { actorId: 2, receiverId: 4, type: NotificationType.MENTION, tweetId: omarGReply1.id },
      { actorId: 4, receiverId: 1, type: NotificationType.MENTION, tweetId: anasReply2.id },
      { actorId: 3, receiverId: 6, type: NotificationType.MENTION, tweetId: laylaTweet1.id },
      { actorId: 2, receiverId: 6, type: NotificationType.RETWEET, tweetId: laylaTweet1.id },
      { actorId: 3, receiverId: 4, type: NotificationType.RETWEET, tweetId: anasTweet1.id },
      { actorId: 8, receiverId: 4, type: NotificationType.RETWEET, tweetId: anasTweet1.id },
      { actorId: 5, receiverId: 7, type: NotificationType.QUOTE, tweetId: gelgelQuoteTweet.id },
      { actorId: 10, receiverId: 12, type: NotificationType.RETWEET, tweetId: fatmaTweet1.id },
      { actorId: 4, receiverId: 1, type: NotificationType.MESSAGE },
      { actorId: 4, receiverId: 2, type: NotificationType.MESSAGE },
      { actorId: 1, receiverId: 4, type: NotificationType.MESSAGE },
      { actorId: 1, receiverId: 2, type: NotificationType.MESSAGE },
      { actorId: 2, receiverId: 4, type: NotificationType.MESSAGE },
      { actorId: 2, receiverId: 1, type: NotificationType.MESSAGE },
      { actorId: 6, receiverId: 3, type: NotificationType.MESSAGE },
      { actorId: 8, receiverId: 12, type: NotificationType.MESSAGE },
      { actorId: 8, receiverId: 9, type: NotificationType.MESSAGE },
      { actorId: 12, receiverId: 8, type: NotificationType.MESSAGE },
      { actorId: 12, receiverId: 9, type: NotificationType.MENTION },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
