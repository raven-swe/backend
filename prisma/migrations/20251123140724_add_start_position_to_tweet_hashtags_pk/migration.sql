/*
  Warnings:

  - The primary key for the `tweet_hashtags` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "tweet_hashtags" DROP CONSTRAINT "tweet_hashtags_pkey",
ADD CONSTRAINT "tweet_hashtags_pkey" PRIMARY KEY ("hashtag_id", "tweet_id", "starting_index");
