/*
  Warnings:

  - A unique constraint covering the columns `[media_id]` on the table `messages` will be added. If there are existing duplicate values, this will fail.

*/

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "media_id" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "messages_media_id_key" ON "messages"("media_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
