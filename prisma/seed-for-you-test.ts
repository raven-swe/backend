import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// --- CONFIGURATION ---
const NUM_AUTHORS = 100; // Users who will be creating content
const NUM_TWEETS_PER_AUTHOR = 50; // Each author will create many tweets
const PERCENT_OF_AUTHORS_TO_FOLLOW = 0.3; // Our test user will follow 30% of all authors

// Available tweet categories/interests
const TWEET_CATEGORIES = [
  'technology',
  'sports',
  'politics',
  'entertainment',
  'science',
  'gaming',
  'music',
  'food',
  'travel',
  'fitness',
  'fashion',
  'art',
  'business',
  'education',
  'health',
];

// User interests (subset of categories)
const USER_INTERESTS = ['technology', 'gaming', 'science', 'music'];

async function main() {
  // DO NOT USE IN PRODUCTION AS IT DELETES EVERYTHING, THIS IS FOR TESTING ONLY
  await prisma.retweet.deleteMany();
  await prisma.like.deleteMany();
  await prisma.tweetHashtag.deleteMany();
  await prisma.tweetMention.deleteMany();
  await prisma.tweetMedia.deleteMany();

  await prisma.follow.deleteMany();
  await prisma.mute.deleteMany();
  await prisma.block.deleteMany();

  await prisma.refreshToken.deleteMany();
  await prisma.userDevice.deleteMany();

  await prisma.userExternalAccount.deleteMany();

  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();

  await prisma.notification.deleteMany();
  await prisma.media.deleteMany();

  await prisma.profile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.tweet.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create the single user we will use for testing For You feed
  const passwordHash = await bcrypt.hash('test1234', 10);
  const testUser = await prisma.user.create({
    data: {
      username: 'testuser',
      email: 'testuser@test.com',
      passwordHash,
      birthdate: new Date('1990-01-01'),
      interests: USER_INTERESTS, // User's interests for For You feed
      profile: { create: { displayName: 'Test User For You' } },
    },
  });

  // Create some additional named users
  const omar = await prisma.user.create({
    data: {
      username: 'omar',
      email: 'omar@test.com',
      passwordHash,
      birthdate: new Date('1990-01-01'),
      interests: ['technology', 'gaming'],
      profile: { create: { displayName: 'Omar' } },
    },
  });

  const loay = await prisma.user.create({
    data: {
      username: 'loay',
      email: 'loay@test.com',
      passwordHash,
      birthdate: new Date('1990-01-01'),
      interests: ['sports', 'fitness'],
      profile: { create: { displayName: 'Loay' } },
    },
  });

  const tasneem = await prisma.user.create({
    data: {
      username: 'tasneem',
      email: 'tasneem@test.com',
      passwordHash,
      birthdate: new Date('1990-01-01'),
      interests: ['art', 'music', 'fashion'],
      profile: { create: { displayName: 'Tasneem' } },
    },
  });

  // 3. Generate a large number of "author" users
  const authorsToCreate = [];
  for (let i = 0; i < NUM_AUTHORS; i++) {
    // Each author has 1-3 random interests
    const numInterests = faker.number.int({ min: 1, max: 3 });
    const authorInterests = faker.helpers.arrayElements(TWEET_CATEGORIES, numInterests);

    authorsToCreate.push({
      username:
        faker.internet
          .username()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '') + `_${i}`,
      email: `author_${i}_${faker.string.alphanumeric(5)}@test.com`.toLowerCase(),
      birthdate: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }),
      passwordHash,
      interests: authorInterests,
    });
  }
  await prisma.user.createMany({ data: authorsToCreate, skipDuplicates: true });

  const allAuthors = await prisma.user.findMany({
    where: { id: { notIn: [testUser.id, omar.id, loay.id, tasneem.id] } },
  });

  // Create profiles for all authors
  await prisma.profile.createMany({
    data: allAuthors.map((author) => ({
      userId: author.id,
      displayName: faker.person.fullName(),
    })),
  });

  // 4. Make the test user follow a portion of authors
  const numAuthorsToFollow = Math.floor(NUM_AUTHORS * PERCENT_OF_AUTHORS_TO_FOLLOW);

  // Shuffle authors to get a random subset to follow
  const shuffledAuthors = faker.helpers.shuffle(allAuthors);
  const authorsToFollow = shuffledAuthors.slice(0, numAuthorsToFollow);

  const followsToCreate = authorsToFollow.map((author) => ({
    followerId: testUser.id,
    followedId: author.id,
  }));

  await prisma.follow.createMany({ data: followsToCreate });

  // Update follower/following counts
  await prisma.user.update({
    where: { id: testUser.id },
    data: { followingCount: numAuthorsToFollow },
  });

  for (const author of authorsToFollow) {
    await prisma.user.update({
      where: { id: author.id },
      data: { followersCount: { increment: 1 } },
    });
  }

  // 5. Create tweets with categories (class field)
  const tweetsToCreate = [];
  const followedAuthorIds = new Set(authorsToFollow.map((a) => a.id));

  for (const author of allAuthors) {
    const isFollowed = followedAuthorIds.has(author.id);

    for (let i = 0; i < NUM_TWEETS_PER_AUTHOR; i++) {
      // Pick a single category for the tweet (class is a String, not array)
      const category = faker.helpers.arrayElement(TWEET_CATEGORIES);

      // Generate content related to the category
      const content = generateCategoryContent(category);

      // Tweets from followed users are more recent (last 7 days)
      // Tweets from non-followed users span last 14 days (for interest-based discovery)
      const maxDays = isFollowed ? 7 : 14;

      tweetsToCreate.push({
        userId: author.id,
        content,
        class: category, // Single category string for interest matching
        createdAt: faker.date.recent({ days: maxDays }),
      });
    }
  }

  // Batch insert tweets for performance
  const chunkSize = 5000;
  for (let i = 0; i < tweetsToCreate.length; i += chunkSize) {
    const chunk = tweetsToCreate.slice(i, i + chunkSize);
    await prisma.tweet.createMany({ data: chunk });
  }

  // 6. Add some engagement (likes/retweets) to make ranking interesting

  const allTweets = await prisma.tweet.findMany({
    select: { id: true },
    take: 1000, // Only add engagement to some tweets
    orderBy: { createdAt: 'desc' },
  });

  // Add random likes
  const likesToCreate = [];
  for (const tweet of allTweets) {
    const numLikes = faker.number.int({ min: 0, max: 50 });
    const likers = faker.helpers.arrayElements(allAuthors, Math.min(numLikes, allAuthors.length));

    for (const liker of likers) {
      likesToCreate.push({
        userId: liker.id,
        tweetId: tweet.id,
      });
    }
  }

  // Insert likes in chunks
  for (let i = 0; i < likesToCreate.length; i += chunkSize) {
    const chunk = likesToCreate.slice(i, i + chunkSize);
    await prisma.like.createMany({ data: chunk, skipDuplicates: true });
  }

  // Update like counts
  await prisma.$executeRaw`
    UPDATE tweets 
    SET like_count = (SELECT COUNT(*) FROM likes WHERE likes.tweet_id = tweets.id)
  `;
}

function generateCategoryContent(category: string): string {
  const templates: Record<string, () => string> = {
    technology: () =>
      faker.helpers.arrayElement([
        `Just discovered ${faker.company.buzzNoun()} - this is going to change everything! #tech`,
        `Hot take: ${faker.company.buzzPhrase()} is overrated`,
        `Finally upgraded to the new ${faker.commerce.product()}. Thoughts? 🤔`,
        `The future of ${faker.company.buzzNoun()} is here and I'm here for it`,
      ]),
    sports: () =>
      faker.helpers.arrayElement([
        `What a game last night! ${faker.person.lastName()} was on fire 🔥`,
        `Hot take: ${faker.person.lastName()} is the GOAT, no debate`,
        `Training day! Getting ready for the weekend 💪`,
        `That referee call was absolutely ridiculous`,
      ]),
    politics: () =>
      faker.helpers.arrayElement([
        `Important policy discussion happening right now`,
        `We need to talk about ${faker.company.buzzNoun()} reform`,
        `Democracy requires engaged citizens`,
        `Local elections matter more than you think`,
      ]),
    entertainment: () =>
      faker.helpers.arrayElement([
        `Just watched ${faker.lorem.words(3)} - no spoilers but WOW`,
        `This new show is absolutely binge-worthy`,
        `Unpopular opinion: the sequel was better`,
        `Celebrity news: ${faker.person.fullName()} spotted in ${faker.location.city()}`,
      ]),
    science: () =>
      faker.helpers.arrayElement([
        `Fascinating new research on ${faker.science.chemicalElement().name}`,
        `The universe never stops amazing me 🌌`,
        `Science fact of the day: ${faker.lorem.sentence()}`,
        `New breakthrough in ${faker.science.chemicalElement().name} research!`,
      ]),
    gaming: () =>
      faker.helpers.arrayElement([
        `Finally beat that boss after 100 tries 🎮`,
        `New game announcement has me hyped!`,
        `Looking for squad members tonight, who's in?`,
        `This indie game deserves more attention`,
      ]),
    music: () =>
      faker.helpers.arrayElement([
        `This new album is on repeat all day 🎵`,
        `Unpopular opinion: ${faker.music.genre()} is underrated`,
        `Concert last night was absolutely incredible`,
        `New song dropped and I can't stop listening`,
      ]),
    food: () =>
      faker.helpers.arrayElement([
        `Made ${faker.food.dish()} for dinner tonight 🍽️`,
        `This restaurant is seriously underrated`,
        `Recipe thread coming soon!`,
        `Food coma hitting hard right now`,
      ]),
    travel: () =>
      faker.helpers.arrayElement([
        `Exploring ${faker.location.city()} and loving every minute ✈️`,
        `Travel tip: always pack light`,
        `This view is absolutely breathtaking`,
        `Bucket list destination: checked off!`,
      ]),
    fitness: () =>
      faker.helpers.arrayElement([
        `New PR today! Hard work pays off 💪`,
        `Rest day but still staying active`,
        `This workout routine changed my life`,
        `Meal prep Sunday is the best Sunday`,
      ]),
    fashion: () =>
      faker.helpers.arrayElement([
        `Today's outfit is giving everything`,
        `Fall fashion is my favorite season`,
        `This brand just dropped something amazing`,
        `Vintage finds are the best finds`,
      ]),
    art: () =>
      faker.helpers.arrayElement([
        `New piece finished! What do you think? 🎨`,
        `Art museums are my happy place`,
        `This artist deserves more recognition`,
        `Creative block is real but we push through`,
      ]),
    business: () =>
      faker.helpers.arrayElement([
        `Market update: interesting moves today 📈`,
        `Entrepreneurship lesson of the day`,
        `Networking event was actually worth it`,
        `This startup is one to watch`,
      ]),
    education: () =>
      faker.helpers.arrayElement([
        `Learning never stops 📚`,
        `This online course changed my perspective`,
        `Education should be accessible to everyone`,
        `Study tip: ${faker.lorem.sentence()}`,
      ]),
    health: () =>
      faker.helpers.arrayElement([
        `Mental health reminder: take breaks`,
        `Self-care isn't selfish`,
        `This wellness tip actually works`,
        `Hydration check! Drink water 💧`,
      ]),
  };

  return templates[category]?.() || faker.lorem.sentence();
}

if (process.env.SEED_ENV === 'true') {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error('Seeding failed:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
