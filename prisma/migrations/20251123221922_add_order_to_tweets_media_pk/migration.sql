/*
  Warnings:

  - The primary key for the `tweet_media` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `order` on table `tweet_media` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "tweet_media" DROP CONSTRAINT "tweet_media_pkey",
ALTER COLUMN "order" SET NOT NULL,
ADD CONSTRAINT "tweet_media_pkey" PRIMARY KEY ("tweet_id", "media_id", "order");
