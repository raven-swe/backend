import { PrismaClient, LanguageCode, Gender } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/* ---------------- CONFIG ---------------- */

const NUM_USERS = 50000; // 50k users
const FOLLOW_PERCENT = 0.3; // 30% followed by searcher
const MUTE_PERCENT = 0.05; // 5% muted
const BLOCK_PERCENT = 0.02; // 2% blocked
const SEED_DOMAIN = '@searchseed.com'; // safe domain for seed users

/* ------------ HELPERS ------------------ */

function generateUsername(base: string, i: number) {
  const patterns = [
    `${base}`,
    `${base}${i}`,
    `${base}_dev`,
    `${base}_official`,
    `${base}.io`,
    `${base}_x`,
    `${base}_fan`,
    `${base}${faker.number.int({ min: 10, max: 999 })}`,
    `${base}${faker.word.sample()}`,
    `${faker.internet.username({ firstName: base })}`, // FIXED
  ];
  return faker.helpers.arrayElement(patterns).toLowerCase();
}

/* ------------ MAIN SEED ----------------- */

async function main() {
  console.log('--- Seeding 50K SEARCH users safely ---');
  console.time('seed');

  /* -------- SAFE CLEANUP -------- */
  console.log('Soft deleting previous seeded users...');

  await prisma.follow.deleteMany({
    where: { followerUser: { email: { endsWith: SEED_DOMAIN } } },
  });

  await prisma.mute.deleteMany({
    where: { muterUser: { email: { endsWith: SEED_DOMAIN } } },
  });

  await prisma.block.deleteMany({
    where: { blocker: { email: { endsWith: SEED_DOMAIN } } },
  });

  await prisma.profile.deleteMany({
    where: { user: { email: { endsWith: SEED_DOMAIN } } },
  });

  await prisma.user.updateMany({
    where: { email: { endsWith: SEED_DOMAIN } },
    data: { deletedAt: new Date() },
  });

  console.log('✅ Cleanup finished');

  /* -------- CREATE SEARCHER USER -------- */
  const passwordHash = await bcrypt.hash('search123', 10);

  const searchUser = await prisma.user.upsert({
    where: { email: `searcher${SEED_DOMAIN}` },
    update: { deletedAt: null },
    create: {
      username: 'searcher',
      email: `searcher${SEED_DOMAIN}`,
      passwordHash,
      birthdate: new Date('1995-01-01'),
      languageCode: LanguageCode.EN,
      profile: {
        create: {
          displayName: 'Search Tester',
          bio: 'Benchmarking user search',
        },
      },
    },
  });

  console.log('✅ Search user ready');

  /* -------- GENERATE USERS -------- */
  // Large name pool
  const baseNames = Array.from({ length: 200 }, () => faker.person.firstName().toLowerCase());

  const newUsers = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const base = faker.helpers.arrayElement(baseNames);
    newUsers.push({
      username: generateUsername(base, i),
      email: `${faker.string.uuid()}${SEED_DOMAIN}`,
      passwordHash,
      birthdate: faker.date.birthdate({ min: 18, max: 60, mode: 'age' }),
      languageCode: faker.helpers.arrayElement([LanguageCode.EN, LanguageCode.AR]),
      gender: faker.helpers.arrayElement([null, Gender.MALE, Gender.FEMALE]),
    });
  }

  /* -------- INSERT USERS IN BATCHES -------- */
  console.log('Creating users in batches...');
  const batchSize = 1000;
  for (let i = 0; i < newUsers.length; i += batchSize) {
    await prisma.user.createMany({
      data: newUsers.slice(i, i + batchSize),
      skipDuplicates: true,
    });
  }

  const users = await prisma.user.findMany({
    where: {
      email: { endsWith: SEED_DOMAIN },
      NOT: { id: searchUser.id },
      deletedAt: null,
    },
  });

  /* -------- CREATE PROFILES -------- */
  console.log('Creating profiles...');
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    await prisma.profile.createMany({
      data: batch.map((u) => ({
        userId: u.id,
        displayName: faker.person.fullName(),
        bio: faker.lorem.sentence({ min: 5, max: 15 }),
        location: faker.location.city(),
        websiteUrl: faker.internet.url(),
        avatarUrl: faker.image.avatar(),
      })),
    });
  }

  /* -------- CREATE RELATIONSHIPS -------- */
  console.log('Creating follow, mute, and block relationships...');
  const followCount = Math.floor(NUM_USERS * FOLLOW_PERCENT);
  const muteCount = Math.floor(NUM_USERS * MUTE_PERCENT);
  const blockCount = Math.floor(NUM_USERS * BLOCK_PERCENT);

  const shuffled = faker.helpers.shuffle(users);

  await prisma.follow.createMany({
    data: shuffled.slice(0, followCount).map((u) => ({
      followerId: searchUser.id,
      followedId: u.id,
    })),
  });

  await prisma.mute.createMany({
    data: shuffled.slice(followCount, followCount + muteCount).map((u) => ({
      userId: searchUser.id,
      mutedId: u.id,
    })),
  });

  await prisma.block.createMany({
    data: shuffled
      .slice(followCount + muteCount, followCount + muteCount + blockCount)
      .map((u) => ({
        userId: searchUser.id,
        blockedId: u.id,
      })),
  });

  console.log(`
✅ Seed completed:

Total users: ${users.length}
Followed: ${followCount}
Muted: ${muteCount}
Blocked: ${blockCount}

Login credentials:
Email: searcher${SEED_DOMAIN}
Password: search123
`);

  console.timeEnd('seed');
}

/* ------------ RUNNER ---------------- */
main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('SEED FAILED:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
