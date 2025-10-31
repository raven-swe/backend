/*
  Warnings:

  - You are about to drop the `hashtags` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "Categories" AS ENUM ('NEWS', 'SPORTS', 'ENTERTAINMENT');

-- DropForeignKey
ALTER TABLE "public"."tweet_hashtags" DROP CONSTRAINT "tweet_hashtags_hashtag_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."tweet_hashtags" DROP CONSTRAINT "tweet_hashtags_tweet_id_fkey";

-- DropTable
DROP TABLE "public"."hashtags";

-- CreateTable
CREATE TABLE "trending_keywords" (
    "id" BIGSERIAL NOT NULL,
    "keyword" VARCHAR(100) NOT NULL,
    "category" "Categories",
    "last_updated_at" TIMESTAMP(3),
    "isHashtag" BOOLEAN NOT NULL DEFAULT false,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trending_keywords_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tweet_hashtags" ADD CONSTRAINT "tweet_hashtags_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "trending_keywords"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tweet_hashtags" ADD CONSTRAINT "tweet_hashtags_tweet_id_fkey" FOREIGN KEY ("tweet_id") REFERENCES "tweets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
