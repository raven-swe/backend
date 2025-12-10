/*
  Warnings:

  - You are about to drop the column `search_document` on the `tweets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "reaction_receiver" TEXT,
ADD COLUMN     "reaction_receiver_at" TIMESTAMP(3),
ADD COLUMN     "reaction_sender" TEXT,
ADD COLUMN     "reaction_sender_at" TIMESTAMP(3);

