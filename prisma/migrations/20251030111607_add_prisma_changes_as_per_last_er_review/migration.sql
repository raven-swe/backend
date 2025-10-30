/*
  Warnings:

  - The primary key for the `conversation_participants` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `conversation_participants` table. All the data in the column will be lost.
  - You are about to drop the column `tweet_id` on the `media` table. All the data in the column will be lost.
  - You are about to alter the column `url` on the `media` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `width` on the `media` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `height` on the `media` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `avatar_url` on the `profiles` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `banner_url` on the `profiles` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `location` on the `profiles` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `website_url` on the `profiles` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to drop the column `is_deleted` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."media" DROP CONSTRAINT "media_tweet_id_fkey";

-- DropIndex
DROP INDEX "public"."conversation_participants_conversation_id_user_id_idx";

-- DropIndex
DROP INDEX "public"."user_devices_fcm_token_key";

-- AlterTable
ALTER TABLE "conversation_participants" DROP CONSTRAINT "conversation_participants_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "conversation_participants_conversation_id_user_id_idx" PRIMARY KEY ("conversation_id", "user_id");

-- AlterTable
ALTER TABLE "media" DROP COLUMN "tweet_id",
ALTER COLUMN "url" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "width" SET DATA TYPE INTEGER,
ALTER COLUMN "height" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "profiles" ALTER COLUMN "avatar_url" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "banner_url" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "location" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "website_url" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "is_deleted",
ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
