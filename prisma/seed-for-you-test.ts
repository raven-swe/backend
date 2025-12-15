import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// test1234
async function main() {
  await prisma.user.upsert({
    where: { email: 'fy@test.com' },
    update: {},
    create: {
      username: 'omar',
      email: 'fy@test.com',
      passwordHash: '$2a$10$faoFdN3VO833Agy0pdZRS.OozTd8R5Z.aEUnK/1fxwByQjx/OPBii',
      birthdate: new Date('2000-01-01'),
      interests: ['ENTERTAINMENT'],
      profile: { create: { displayName: 'FY Tester' } },
    },
  });

  const u1 = await prisma.user.upsert({
    where: { email: 'u1@test.com' },
    update: {},
    create: {
      username: 'sportsu',
      email: 'u1@test.com',
      passwordHash: '$2a$10$faoFdN3VO833Agy0pdZRS.OozTd8R5Z.aEUnK/1fxwByQjx/OPBii',
      birthdate: new Date('1995-05-15'),
      interests: ['SPORTS'],
      profile: { create: { displayName: 'Sports' } },
    },
  });

  const u2 = await prisma.user.upsert({
    where: { email: 'u2@test.com' },
    update: {},
    create: {
      username: 'techu',
      email: 'u2@test.com',
      passwordHash: '$2a$10$faoFdN3VO833Agy0pdZRS.OozTd8R5Z.aEUnK/1fxwByQjx/OPBii',
      birthdate: new Date('1990-03-20'),
      interests: ['TECH'],
      profile: { create: { displayName: 'Tech' } },
    },
  });

  const u3 = await prisma.user.upsert({
    where: { email: 'u3@test.com' },
    update: {},
    create: {
      username: 'entu',
      email: 'u3@test.com',
      passwordHash: '$2a$10$faoFdN3VO833Agy0pdZRS.OozTd8R5Z.aEUnK/1fxwByQjx/OPBii',
      birthdate: new Date('1998-07-10'),
      interests: ['ENTERTAINMENT'],
      profile: { create: { displayName: 'Ent' } },
    },
  });

  const u4 = await prisma.user.upsert({
    where: { email: 'u4@test.com' },
    update: {},
    create: {
      username: 'foodu',
      email: 'u4@test.com',
      passwordHash: '$2a$10$faoFdN3VO833Agy0pdZRS.OozTd8R5Z.aEUnK/1fxwByQjx/OPBii',
      birthdate: new Date('1992-11-25'),
      interests: ['FOOD'],
      profile: { create: { displayName: 'Food' } },
    },
  });

  const u5 = await prisma.user.upsert({
    where: { email: 'u5@test.com' },
    update: {},
    create: {
      username: 'genu',
      email: 'u5@test.com',
      passwordHash: '$2a$10$faoFdN3VO833Agy0pdZRS.OozTd8R5Z.aEUnK/1fxwByQjx/OPBii',
      birthdate: new Date('1988-02-14'),
      interests: ['GENERAL'],
      profile: { create: { displayName: 'Gen' } },
    },
  });

  const tweetData = [
    {
      userId: u1.id,
      content: 'NBA game last night!',
      class: 'SPORTS',
      likeCount: 150,
      retweetCount: 45,
    },
    {
      userId: u1.id,
      content: 'World Cup predictions?',
      class: 'SPORTS',
      likeCount: 200,
      retweetCount: 80,
    },
    {
      userId: u1.id,
      content: 'NFL playoffs heating up',
      class: 'SPORTS',
      likeCount: 75,
      retweetCount: 20,
    },
    {
      userId: u1.id,
      content: 'Tennis Grand Slam soon',
      class: 'SPORTS',
      likeCount: 50,
      retweetCount: 10,
    },
    {
      userId: u1.id,
      content: 'Swimming records broken',
      class: 'SPORTS',
      likeCount: 120,
      retweetCount: 35,
    },
    {
      userId: u2.id,
      content: 'New AI model is amazing',
      class: 'TECH',
      likeCount: 300,
      retweetCount: 100,
    },
    {
      userId: u2.id,
      content: 'MacBook Pro review',
      class: 'TECH',
      likeCount: 180,
      retweetCount: 55,
    },
    {
      userId: u2.id,
      content: 'Cybersecurity tips 2024',
      class: 'TECH',
      likeCount: 90,
      retweetCount: 40,
    },
    {
      userId: u2.id,
      content: 'Foldables or AR glasses?',
      class: 'TECH',
      likeCount: 65,
      retweetCount: 15,
    },
    {
      userId: u2.id,
      content: 'Building robot Arduino',
      class: 'TECH',
      likeCount: 45,
      retweetCount: 8,
    },
    {
      userId: u3.id,
      content: 'New Marvel movie WOW',
      class: 'Entertainment',
      likeCount: 500,
      retweetCount: 200,
    },
    {
      userId: u3.id,
      content: 'Taylor Swift new album',
      class: 'Entertainment',
      likeCount: 800,
      retweetCount: 350,
    },
    {
      userId: u3.id,
      content: 'Best TV shows to binge',
      class: 'Entertainment',
      likeCount: 150,
      retweetCount: 45,
    },
    {
      userId: u3.id,
      content: 'Broadway is back',
      class: 'Entertainment',
      likeCount: 70,
      retweetCount: 20,
    },
    {
      userId: u3.id,
      content: 'New video game release',
      class: 'Entertainment',
      likeCount: 250,
      retweetCount: 90,
    },
    {
      userId: u4.id,
      content: 'Best pizza recipe',
      class: 'FOOD',
      likeCount: 100,
      retweetCount: 30,
    },
    {
      userId: u4.id,
      content: 'Sushi masterclass soon',
      class: 'FOOD',
      likeCount: 80,
      retweetCount: 25,
    },
    {
      userId: u4.id,
      content: 'Healthy meal prep ideas',
      class: 'FOOD',
      likeCount: 60,
      retweetCount: 15,
    },
    {
      userId: u5.id,
      content: 'Good morning everyone!',
      class: 'GENERAL',
      likeCount: 20,
      retweetCount: 5,
    },
    {
      userId: u5.id,
      content: 'Random thought today',
      class: 'GENERAL',
      likeCount: 35,
      retweetCount: 10,
    },
    {
      userId: u5.id,
      content: 'Finished my project!',
      class: 'GENERAL',
      likeCount: 15,
      retweetCount: 3,
    },
  ];

  const now = new Date();
  for (let i = 0; i < tweetData.length; i++) {
    const data = tweetData[i];
    await prisma.tweet.create({
      data: {
        userId: data.userId,
        content: data.content,
        class: data.class,
        likeCount: data.likeCount,
        retweetCount: data.retweetCount,
        createdAt: new Date(now.getTime() - i * 3600000),
      },
    });
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
