import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// --- CONFIGURATION ---
const NUM_AUTHORS = 1000; // Users who will be creating content
const NUM_TWEETS_PER_AUTHOR = 100; // Each author will create many tweets
const PERCENT_OF_AUTHORS_TO_FOLLOW = 0.5; // Our test user will follow 50% of all authors

async function main() {
  await prisma.retweet.deleteMany();
  await prisma.like.deleteMany();
  await prisma.tweetHashtag.deleteMany();
  await prisma.tweetMention.deleteMany();
  await prisma.tweetMedia.deleteMany();

  await prisma.tweet.deleteMany();

  await prisma.follow.deleteMany();
  await prisma.mute.deleteMany();
  await prisma.block.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create the single user we will use for profiling
  const passwordHash = await bcrypt.hash('test1234', 10);

  const testUser = await prisma.user.create({
    data: {
      username: 'follower',
      email: 'follower@test.com',
      passwordHash,
      birthdate: new Date('1990-01-01'),
      profile: { create: { displayName: 'Test Follower' } },
    },
  });

  // 3. Generate a large number of "author" users
  const authorsToCreate = [];
  for (let i = 0; i < NUM_AUTHORS; i++) {
    authorsToCreate.push({
      username: faker.internet.username().toLowerCase() + `_author_${i}`,
      email: faker.internet.email().toLowerCase(),
      birthdate: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }),
      passwordHash,
    });
  }
  await prisma.user.createMany({ data: authorsToCreate, skipDuplicates: true });

  const allAuthors = await prisma.user.findMany({ where: { id: { not: testUser.id } } });

  // Create profiles for all authors
  await prisma.profile.createMany({
    data: allAuthors.map((author) => ({
      userId: author.id,
      displayName: faker.person.fullName(),
    })),
  });

  // 4. Make the test user follow a large number of authors
  const numAuthorsToFollow = Math.floor(NUM_AUTHORS * PERCENT_OF_AUTHORS_TO_FOLLOW);

  // Shuffle authors to get a random subset to follow
  const shuffledAuthors = faker.helpers.shuffle(allAuthors);
  const authorsToFollow = shuffledAuthors.slice(0, numAuthorsToFollow);

  const followsToCreate = authorsToFollow.map((author) => ({
    followerId: testUser.id,
    followedId: author.id,
  }));

  await prisma.follow.createMany({ data: followsToCreate });

  const tweetsToCreate = [];
  for (const author of allAuthors) {
    for (let i = 0; i < NUM_TWEETS_PER_AUTHOR; i++) {
      tweetsToCreate.push({
        userId: author.id,
        content: faker.lorem.sentence({ min: 5, max: 25 }),
        createdAt: faker.date.recent({ days: 30 }), // Tweets from the last 30 days
      });
    }
  }

  // Batch insert tweets for performance
  // We need to do this in chunks as Prisma has limits on the number of parameters
  const chunkSize = 5000;
  for (let i = 0; i < tweetsToCreate.length; i += chunkSize) {
    const chunk = tweetsToCreate.slice(i, i + chunkSize);
    await prisma.tweet.createMany({ data: chunk });
  }
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
