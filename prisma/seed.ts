import { PrismaClient, MediaType, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.tweets.updateMany({
    data: { quoted_tweet_id: null, reply_to_tweet_id: null },
  });
  await prisma.conversations.updateMany({
    data: { last_message_id: null },
  });
  await prisma.conversation_participants.updateMany({
    data: { last_seen_message_id: null },
  });
  await prisma.notifications.deleteMany();
  await prisma.conversation_participants.deleteMany();
  await prisma.messages.deleteMany();
  await prisma.conversations.deleteMany();
  await prisma.likes.deleteMany();
  await prisma.retweets.deleteMany();
  await prisma.tweet_media.deleteMany();
  await prisma.media.deleteMany();
  await prisma.tweet_hashtags.deleteMany();
  await prisma.hashtags.deleteMany();
  await prisma.tweet_mentions.deleteMany();
  await prisma.tweets.deleteMany();
  await prisma.mutes.deleteMany();
  await prisma.blocks.deleteMany();
  await prisma.follows.deleteMany();
  await prisma.refresh_tokens.deleteMany();
  await prisma.user_devices.deleteMany();
  await prisma.user_external_accounts.deleteMany();
  await prisma.profiles.deleteMany();
  await prisma.users.deleteMany();

  await prisma.$executeRaw`ALTER SEQUENCE "users_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "refresh_tokens_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "user_devices_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "tweets_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "hashtags_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "messages_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "conversations_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "conversation_participants_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "notifications_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "media_id_seq" RESTART WITH 1;`;

  const usersToCreate = [
    {
      username: 'OmarHassan',
      email: 'omar@gmail.com',
      password_hash: '$2a$10$skJLBvUxlf0KBnUGNAG0BuDb.v6mUbKgGlVfWaTEsHNJtk00qvBNS',
      birthdate: new Date('2003-08-04'),
      profile: { create: { display_name: 'Omar Hassan' } },
    },
    {
      username: 'notnowomar',
      email: 'omarg@gmail.com',
      password_hash: '$2a$10$OQw7ZoP7SETenCXbALgfD.eAKegNI0FUMwpqpPS977X017JaMG6dC',
      birthdate: new Date('2003-12-04'),
      profile: {
        create: {
          display_name: 'Omar Gamal',
          bio: 'Frontend enthusiast.',
          location: 'Alexandria, Egypt',
        },
      },
    },
    {
      username: 'Tasneem',
      email: 'tasneem@gmail.com',
      password_hash: '$2a$10$SAgbBSiZOk8LW/9IaD2PzOtlQi39JWaLLkmRrTobcLWqZIRoNptYu',
      birthdate: new Date('2004-08-04'),
      phone: '01001013205',
      profile: { create: { display_name: 'Tasneem', bio: 'Life is good.' } },
    },
    {
      username: 'anasbrahim',
      email: 'anas@gmail.com',
      password_hash: '$2a$10$F.6W9pCnJ9PNq1X7ExOZ1OcF1RIke/nqVxCUbgi.FDl.jrCBdC7wq',
      birthdate: new Date('2004-08-04'),
      phone: '01005013203',
      profile: { create: { display_name: 'Anas' } },
    },
    {
      username: 'gelgel',
      email: 'mostafa@gmail.com',
      password_hash: '$2a$10$QHBO7om6Al91AXUn7kzVf.ftg3fMhQBDUAKUn5q7X3ymjmT5f68R2',
      birthdate: new Date('2003-12-05'),
      phone: '01005013209',
      profile: { create: { display_name: 'Mostafa' } },
    },
    {
      username: 'Layla',
      email: 'layla@gmail.com',
      password_hash: '$2a$10$bE.9Z9.E1c.g2k4Z3H1fO.B5n1X2w3V4u5s6t7y8Z9A0B1c2d3E4',
      birthdate: new Date('2002-05-15'),
      profile: { create: { display_name: 'Layla El-Sayed', bio: 'Designer & Photographer 📸' } },
    },
    {
      username: 'kimo',
      email: 'karim@gmail.com',
      password_hash: '$2a$10$fG.8h7j6K5L4M3N2P1q0R.o9s8d7f6g5h4j3k2l1I0E9F8d7c6b5',
      birthdate: new Date('2003-11-20'),
      profile: { create: { display_name: 'karim', bio: 'Just here for the memes.' } },
    },
    {
      username: 'SaraA',
      email: 'sara@gmail.com',
      password_hash: '$2a$10$aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789AbCdEfGhIjKlMnOp',
      birthdate: new Date('2001-03-10'),
      phone: '01001234567',
      profile: { create: { display_name: 'Sara Ahmed', bio: 'Backend dev & coffee addict ☕' } },
    },
    {
      username: 'ZakiDev',
      email: 'ahmedz@gmail.com',
      password_hash: '$2a$10$QrStUvWxYz0123456789AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      birthdate: new Date('2004-07-22'),
      profile: { create: { display_name: 'Ahmed Zaki', bio: 'Learning GraphQL daily.' } },
    },
    {
      username: 'NourCodes',
      email: 'nour@gmail.com',
      password_hash: '$2a$10$1234567890AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfG',
      birthdate: new Date('2002-09-18'),
      profile: { create: { display_name: 'Nour', bio: 'Full-stack explorer.' } },
    },
    {
      username: 'YoussefTech',
      email: 'youssef@gmail.com',
      password_hash: '$2a$10$hIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIjKlMnOpQrStUvW',
      birthdate: new Date('2003-02-14'),
      phone: '01009876543',
      profile: { create: { display_name: 'Youssef', bio: 'AI enthusiast 🤖' } },
    },
    {
      username: 'FatmaDesign',
      email: 'fatma@gmail.com',
      password_hash: '$2a$10$xYz0123456789AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCd',
      birthdate: new Date('2004-11-30'),
      profile: { create: { display_name: 'Fatma', bio: 'UI/UX magic maker.' } },
    },
  ];
  for (const user of usersToCreate) {
    await prisma.users.create({ data: user });
  }

  await prisma.follows.createMany({
    data: [
      { follower_id: 1, followed_id: 2, with_notifications: true },
      { follower_id: 1, followed_id: 4 },
      { follower_id: 1, followed_id: 6 },
      { follower_id: 1, followed_id: 8 },
      { follower_id: 1, followed_id: 10 },
      { follower_id: 2, followed_id: 1 },
      { follower_id: 2, followed_id: 3 },
      { follower_id: 2, followed_id: 4 },
      { follower_id: 2, followed_id: 9 },
      { follower_id: 3, followed_id: 2 },
      { follower_id: 3, followed_id: 6 },
      { follower_id: 3, followed_id: 11 },
      { follower_id: 4, followed_id: 1 },
      { follower_id: 4, followed_id: 2 },
      { follower_id: 4, followed_id: 5 },
      { follower_id: 4, followed_id: 12 },
      { follower_id: 5, followed_id: 4 },
      { follower_id: 5, followed_id: 7 },
      { follower_id: 5, followed_id: 8 },
      { follower_id: 6, followed_id: 1 },
      { follower_id: 6, followed_id: 3 },
      { follower_id: 6, followed_id: 10 },
      { follower_id: 7, followed_id: 2 },
      { follower_id: 7, followed_id: 5 },
      { follower_id: 7, followed_id: 9 },
      { follower_id: 8, followed_id: 1, with_notifications: true },
      { follower_id: 8, followed_id: 4 },
      { follower_id: 8, followed_id: 6 },
      { follower_id: 9, followed_id: 2 },
      { follower_id: 9, followed_id: 7 },
      { follower_id: 10, followed_id: 1 },
      { follower_id: 10, followed_id: 6 },
      { follower_id: 11, followed_id: 3 },
      { follower_id: 11, followed_id: 4 },
      { follower_id: 12, followed_id: 6 },
      { follower_id: 12, followed_id: 8 },
    ],
  });

  await prisma.blocks.createMany({
    data: [
      { user_id: 3, blocked_id: 5 },
      { user_id: 7, blocked_id: 11 },
      { user_id: 9, blocked_id: 12 },
    ],
  });

  await prisma.mutes.createMany({
    data: [
      { user_id: 1, muted_id: 7 },
      { user_id: 6, muted_id: 10 },
      { user_id: 4, muted_id: 2 },
    ],
  });

  const getHashtag = async (tag: string) =>
    prisma.hashtags.upsert({
      where: { tag },
      update: { count: { increment: 1 } },
      create: { tag, count: 1 },
    });

  const tsHashtag = await getHashtag('typescript');
  const nestHashtag = await getHashtag('nestjs');
  const authHashtag = await getHashtag('auth');

  const anasTweet1 = await prisma.tweets.create({
    data: {
      user_id: 4,
      content:
        'Just deployed my first app with #nestjs. The developer experience is amazing compared to Express. #typescript @OmarHassan what do you think?',
      has_hashtags: true,
      has_mentions: true,
      tweet_hashtags: {
        create: [
          { hashtag_id: nestHashtag.id, starting_index: 31 },
          { hashtag_id: tsHashtag.id, starting_index: 88 },
        ],
      },
      tweet_mentions: {
        create: [{ user_id: 1, starting_index: 118 }],
      },
    },
  });

  const omarGReply1 = await prisma.tweets.create({
    data: {
      user_id: 2,
      content: 'Totally agree! The module system keeps everything so clean. @anasbrahim',
      reply_to_tweet_id: anasTweet1.id,
      has_mentions: true,
      tweet_mentions: {
        create: [{ user_id: 4, starting_index: 65 }],
      },
    },
  });

  const omarHReply1 = await prisma.tweets.create({
    data: {
      user_id: 1,
      content: 'How are you handling authentication? Passport.js strategies? #auth',
      reply_to_tweet_id: anasTweet1.id,
      has_hashtags: true,
      tweet_hashtags: {
        create: [{ hashtag_id: authHashtag.id, starting_index: 72 }],
      },
    },
  });

  const anasReply2 = await prisma.tweets.create({
    data: {
      user_id: 4,
      content: 'Yep, using passport-jwt. It integrated surprisingly easily. Thanks @OmarHassan!',
      reply_to_tweet_id: omarHReply1.id,
      has_mentions: true,
      tweet_mentions: {
        create: [{ user_id: 1, starting_index: 52 }],
      },
    },
  });

  const saraReply1 = await prisma.tweets.create({
    data: {
      user_id: 8,
      content: 'Loving this thread! For scalable auth, consider JWT with refresh tokens.',
      reply_to_tweet_id: anasTweet1.id,
    },
  });

  const foodHashtag = await getHashtag('foodie');
  const cairoHashtag = await getHashtag('cairo');
  const egyptHashtag = await getHashtag('egypt');

  const laylaTweet1 = await prisma.tweets.create({
    data: {
      user_id: 6,
      content:
        'Found the best koshary place in downtown #cairo! Must-visit for every #foodie in #egypt 🤤 @Tasneem',
      has_media: true,
      has_hashtags: true,
      has_mentions: true,
      tweet_hashtags: {
        create: [
          { hashtag_id: cairoHashtag.id, starting_index: 41 },
          { hashtag_id: foodHashtag.id, starting_index: 64 },
          { hashtag_id: egyptHashtag.id, starting_index: 78 },
        ],
      },
      tweet_mentions: {
        create: [{ user_id: 3, starting_index: 92 }],
      },
      media: {
        create: {
          user_id: 6,
          type: MediaType.IMAGE,
          url: 'https://i.imgur.com/examplekoshary.jpg',
          alt_text: 'A delicious bowl of koshary',
          width: 800,
          height: 600,
        },
      },
    },
  });

  const tasneemReply1 = await prisma.tweets.create({
    data: {
      user_id: 3,
      content: 'Omg where is this?? Looks incredible! @Layla tag me next time!',
      reply_to_tweet_id: laylaTweet1.id,
      has_mentions: true,
      tweet_mentions: {
        create: [{ user_id: 6, starting_index: 40 }],
      },
    },
  });

  const fatmaReply1 = await prisma.tweets.create({
    data: {
      user_id: 12,
      content: 'Koshary is life! Adding to my list. 😍',
      reply_to_tweet_id: laylaTweet1.id,
    },
  });

  const memeHashtag = await getHashtag('memes');
  const internetHashtag = await getHashtag('internet');

  const karimTweet1 = await prisma.tweets.create({
    data: {
      user_id: 7,
      content: 'Is it just me or is the #internet extra slow today? Share your pain! #memes',
      has_hashtags: true,
      tweet_hashtags: {
        create: [
          { hashtag_id: internetHashtag.id, starting_index: 25 },
          { hashtag_id: memeHashtag.id, starting_index: 58 },
        ],
      },
    },
  });

  const gelgelQuoteTweet = await prisma.tweets.create({
    data: {
      user_id: 5,
      content: 'Definitely not just you. My downloads are crawling. @Kimo this is your fault! 😂',
      quoted_tweet_id: karimTweet1.id,
      has_mentions: true,
      tweet_mentions: {
        create: [{ user_id: 7, starting_index: 58 }],
      },
    },
  });

  const youssefReply1 = await prisma.tweets.create({
    data: {
      user_id: 11,
      content: 'ISP woes unite us all. Time for Starlink? 🚀',
      reply_to_tweet_id: karimTweet1.id,
    },
  });

  const uiuxHashtag = await getHashtag('uiux');
  const designHashtag = await getHashtag('design');

  const fatmaTweet1 = await prisma.tweets.create({
    data: {
      user_id: 12,
      content:
        'Quick tip for better #uiux: Always test with real users. What’s your go-to tool? #design @ZakiDev',
      has_hashtags: true,
      has_mentions: true,
      tweet_hashtags: {
        create: [
          { hashtag_id: uiuxHashtag.id, starting_index: 22 },
          { hashtag_id: designHashtag.id, starting_index: 60 },
        ],
      },
      tweet_mentions: {
        create: [{ user_id: 9, starting_index: 74 }],
      },
    },
  });

  const ahmedZReply1 = await prisma.tweets.create({
    data: {
      user_id: 9,
      content: 'Figma all the way, but user testing is overrated sometimes. @FatmaDesign',
      reply_to_tweet_id: fatmaTweet1.id,
      has_mentions: true,
      tweet_mentions: {
        create: [{ user_id: 12, starting_index: 52 }],
      },
    },
  });

  const aiHashtag = await getHashtag('ai');

  const youssefTweet1 = await prisma.tweets.create({
    data: {
      user_id: 11,
      content: 'AI is changing everything. Excited for the future! #ai @YoussefTech self-promo 😏',
      has_hashtags: true,
      tweet_hashtags: {
        create: [{ hashtag_id: aiHashtag.id, starting_index: 38 }],
      },
    },
  });

  const graphqlHashtag = await getHashtag('graphql');

  const nourTweet1 = await prisma.tweets.create({
    data: {
      user_id: 10,
      content: 'Diving deep into #graphql today. Resolvers got me hooked! @NourCodes',
      has_hashtags: true,
      tweet_hashtags: {
        create: [{ hashtag_id: graphqlHashtag.id, starting_index: 15 }],
      },
    },
  });

  await prisma.likes.createMany({
    data: [
      { user_id: 1, tweet_id: anasTweet1.id },
      { user_id: 2, tweet_id: anasTweet1.id },
      { user_id: 5, tweet_id: anasTweet1.id },
      { user_id: 8, tweet_id: anasTweet1.id },
      { user_id: 4, tweet_id: omarGReply1.id },
      { user_id: 1, tweet_id: omarGReply1.id },
      { user_id: 10, tweet_id: omarHReply1.id },
      { user_id: 4, tweet_id: anasReply2.id },
      { user_id: 1, tweet_id: anasReply2.id },
      { user_id: 8, tweet_id: saraReply1.id },
      { user_id: 1, tweet_id: laylaTweet1.id },
      { user_id: 2, tweet_id: laylaTweet1.id },
      { user_id: 3, tweet_id: laylaTweet1.id },
      { user_id: 7, tweet_id: laylaTweet1.id },
      { user_id: 4, tweet_id: tasneemReply1.id },
      { user_id: 6, tweet_id: tasneemReply1.id },
      { user_id: 12, tweet_id: fatmaReply1.id },
      { user_id: 2, tweet_id: karimTweet1.id },
      { user_id: 4, tweet_id: karimTweet1.id },
      { user_id: 5, tweet_id: karimTweet1.id },
      { user_id: 9, tweet_id: karimTweet1.id },
      { user_id: 7, tweet_id: gelgelQuoteTweet.id },
      { user_id: 3, tweet_id: youssefReply1.id },
      { user_id: 6, tweet_id: fatmaTweet1.id },
      { user_id: 1, tweet_id: fatmaTweet1.id },
      { user_id: 9, tweet_id: ahmedZReply1.id },
      { user_id: 12, tweet_id: ahmedZReply1.id },
      { user_id: 2, tweet_id: youssefTweet1.id },
      { user_id: 8, tweet_id: youssefTweet1.id },
      { user_id: 4, tweet_id: nourTweet1.id },
      { user_id: 11, tweet_id: nourTweet1.id },
    ],
  });

  await prisma.retweets.createMany({
    data: [
      { user_id: 2, tweet_id: laylaTweet1.id },
      { user_id: 3, tweet_id: anasTweet1.id },
      { user_id: 8, tweet_id: anasTweet1.id },
      { user_id: 5, tweet_id: karimTweet1.id },
      { user_id: 10, tweet_id: fatmaTweet1.id },
    ],
  });

  await prisma.tweets.updateMany({
    where: {
      id: { in: [anasTweet1.id, omarGReply1.id, omarHReply1.id, anasReply2.id, saraReply1.id] },
    },
    data: { like_count: { increment: 1 } },
  });
  await prisma.tweets.update({
    where: { id: anasTweet1.id },
    data: { like_count: 4, retweet_count: 2, reply_count: 4 },
  });
  await prisma.tweets.update({
    where: { id: omarGReply1.id },
    data: { like_count: 2, reply_count: 0 },
  });
  await prisma.tweets.update({
    where: { id: omarHReply1.id },
    data: { like_count: 1, reply_count: 1 },
  });
  await prisma.tweets.update({ where: { id: anasReply2.id }, data: { like_count: 2 } });
  await prisma.tweets.update({ where: { id: saraReply1.id }, data: { like_count: 1 } });
  await prisma.tweets.update({
    where: { id: laylaTweet1.id },
    data: { like_count: 4, retweet_count: 1, reply_count: 2 },
  });
  await prisma.tweets.update({ where: { id: tasneemReply1.id }, data: { like_count: 2 } });
  await prisma.tweets.update({ where: { id: fatmaReply1.id }, data: { like_count: 1 } });
  await prisma.tweets.update({
    where: { id: karimTweet1.id },
    data: { like_count: 4, retweet_count: 1 },
  });
  await prisma.tweets.update({ where: { id: gelgelQuoteTweet.id }, data: { like_count: 1 } });
  await prisma.tweets.update({ where: { id: youssefReply1.id }, data: { like_count: 1 } });
  await prisma.tweets.update({
    where: { id: fatmaTweet1.id },
    data: { like_count: 2, reply_count: 1 },
  });
  await prisma.tweets.update({ where: { id: ahmedZReply1.id }, data: { like_count: 2 } });
  await prisma.tweets.update({ where: { id: youssefTweet1.id }, data: { like_count: 2 } });
  await prisma.tweets.update({ where: { id: nourTweet1.id }, data: { like_count: 2 } });

  const groupConversation1 = await prisma.conversations.create({
    data: {
      conversation_participants: {
        create: [
          { user_id: 4, notifications_muted: false },
          { user_id: 1, notifications_muted: true },
          { user_id: 2, last_seen_message_id: null },
        ],
      },
    },
  });

  await prisma.messages.create({
    data: {
      content: 'Hey guys, thinking of making that NestJS project open source.',
      conversation_id: groupConversation1.id,
      user_id: 4,
      message_entities: { text: 'Hey guys, thinking of making that NestJS project open source.' },
    },
  });
  await prisma.messages.create({
    data: {
      content: 'Great idea! I can help with the database schema design.',
      conversation_id: groupConversation1.id,
      user_id: 1,
      message_entities: { text: 'Great idea! I can help with the database schema design.' },
    },
  });
  const msg1_3 = await prisma.messages.create({
    data: {
      content: "I'm in! I can set up the frontend with React/Next.js.",
      conversation_id: groupConversation1.id,
      user_id: 2,
      message_entities: { text: "I'm in! I can set up the frontend with React/Next.js." },
    },
  });

  await prisma.conversations.update({
    where: { id: groupConversation1.id },
    data: { last_message_id: msg1_3.id },
  });

  const privateConv1 = await prisma.conversations.create({
    data: {
      conversation_participants: {
        create: [{ user_id: 6 }, { user_id: 3, last_seen_message_id: null }],
      },
    },
  });

  const privMsg1 = await prisma.messages.create({
    data: {
      content: "Tasneem, that koshary spot is at Abou Tarek! Let's go this weekend?",
      conversation_id: privateConv1.id,
      user_id: 6,
      message_entities: {
        text: "Tasneem, that koshary spot is at Abou Tarek! Let's go this weekend?",
      },
    },
  });

  await prisma.conversations.update({
    where: { id: privateConv1.id },
    data: { last_message_id: privMsg1.id },
  });

  const groupConversation2 = await prisma.conversations.create({
    data: {
      conversation_participants: {
        create: [{ user_id: 8 }, { user_id: 12, notifications_muted: false }, { user_id: 9 }],
      },
    },
  });

  await prisma.messages.create({
    data: {
      content: 'Team, ideas for the new app redesign?',
      conversation_id: groupConversation2.id,
      user_id: 8,
      message_entities: { text: 'Team, ideas for the new app redesign?' },
    },
  });
  const msg2_2 = await prisma.messages.create({
    data: {
      content: 'I vote for more intuitive nav. Thoughts @ZakiDev?',
      conversation_id: groupConversation2.id,
      user_id: 12,
      message_entities: {
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

  await prisma.conversations.update({
    where: { id: groupConversation2.id },
    data: { last_message_id: msg2_2.id },
  });

  await prisma.notifications.createMany({
    data: [
      { actor_id: 1, receiver_id: 2, type: NotificationType.FOLLOW, seen: true },
      { actor_id: 1, receiver_id: 4, type: NotificationType.FOLLOW },
      { actor_id: 1, receiver_id: 6, type: NotificationType.FOLLOW },
      { actor_id: 1, receiver_id: 8, type: NotificationType.FOLLOW },
      { actor_id: 2, receiver_id: 1, type: NotificationType.FOLLOW },
      { actor_id: 2, receiver_id: 3, type: NotificationType.FOLLOW },
      { actor_id: 2, receiver_id: 4, type: NotificationType.FOLLOW },
      { actor_id: 2, receiver_id: 9, type: NotificationType.FOLLOW },
      { actor_id: 3, receiver_id: 2, type: NotificationType.FOLLOW },
      { actor_id: 3, receiver_id: 6, type: NotificationType.FOLLOW },
      { actor_id: 3, receiver_id: 11, type: NotificationType.FOLLOW },
      { actor_id: 1, receiver_id: 4, type: NotificationType.LIKE, tweet_id: anasTweet1.id },
      { actor_id: 2, receiver_id: 4, type: NotificationType.LIKE, tweet_id: anasTweet1.id },
      { actor_id: 5, receiver_id: 4, type: NotificationType.LIKE, tweet_id: anasTweet1.id },
      { actor_id: 8, receiver_id: 4, type: NotificationType.LIKE, tweet_id: anasTweet1.id },
      { actor_id: 1, receiver_id: 2, type: NotificationType.LIKE, tweet_id: omarGReply1.id },
      { actor_id: 4, receiver_id: 2, type: NotificationType.LIKE, tweet_id: omarGReply1.id },
      { actor_id: 10, receiver_id: 1, type: NotificationType.LIKE, tweet_id: omarHReply1.id },
      { actor_id: 1, receiver_id: 6, type: NotificationType.LIKE, tweet_id: laylaTweet1.id },
      { actor_id: 3, receiver_id: 6, type: NotificationType.LIKE, tweet_id: laylaTweet1.id },
      { actor_id: 7, receiver_id: 6, type: NotificationType.LIKE, tweet_id: laylaTweet1.id },
      { actor_id: 2, receiver_id: 4, type: NotificationType.REPLY, tweet_id: omarGReply1.id },
      { actor_id: 1, receiver_id: 4, type: NotificationType.REPLY, tweet_id: omarHReply1.id },
      { actor_id: 4, receiver_id: 1, type: NotificationType.REPLY, tweet_id: anasReply2.id },
      { actor_id: 8, receiver_id: 4, type: NotificationType.REPLY, tweet_id: saraReply1.id },
      { actor_id: 3, receiver_id: 6, type: NotificationType.REPLY, tweet_id: tasneemReply1.id },
      { actor_id: 12, receiver_id: 6, type: NotificationType.REPLY, tweet_id: fatmaReply1.id },
      { actor_id: 1, receiver_id: 4, type: NotificationType.MENTION, tweet_id: anasTweet1.id },
      { actor_id: 2, receiver_id: 4, type: NotificationType.MENTION, tweet_id: omarGReply1.id },
      { actor_id: 4, receiver_id: 1, type: NotificationType.MENTION, tweet_id: anasReply2.id },
      { actor_id: 3, receiver_id: 6, type: NotificationType.MENTION, tweet_id: laylaTweet1.id },
      { actor_id: 2, receiver_id: 6, type: NotificationType.RETWEET, tweet_id: laylaTweet1.id },
      { actor_id: 3, receiver_id: 4, type: NotificationType.RETWEET, tweet_id: anasTweet1.id },
      { actor_id: 8, receiver_id: 4, type: NotificationType.RETWEET, tweet_id: anasTweet1.id },
      { actor_id: 5, receiver_id: 7, type: NotificationType.QUOTE, tweet_id: gelgelQuoteTweet.id },
      { actor_id: 10, receiver_id: 12, type: NotificationType.RETWEET, tweet_id: fatmaTweet1.id },
      { actor_id: 4, receiver_id: 1, type: NotificationType.MESSAGE },
      { actor_id: 4, receiver_id: 2, type: NotificationType.MESSAGE },
      { actor_id: 1, receiver_id: 4, type: NotificationType.MESSAGE },
      { actor_id: 1, receiver_id: 2, type: NotificationType.MESSAGE },
      { actor_id: 2, receiver_id: 4, type: NotificationType.MESSAGE },
      { actor_id: 2, receiver_id: 1, type: NotificationType.MESSAGE },
      { actor_id: 6, receiver_id: 3, type: NotificationType.MESSAGE },
      { actor_id: 8, receiver_id: 12, type: NotificationType.MESSAGE },
      { actor_id: 8, receiver_id: 9, type: NotificationType.MESSAGE },
      { actor_id: 12, receiver_id: 8, type: NotificationType.MESSAGE },
      { actor_id: 12, receiver_id: 9, type: NotificationType.MENTION },
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
