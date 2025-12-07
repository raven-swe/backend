/*
  Warnings:

  - You are about to drop the column `search_document` on the `tweets` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[session_id]` on the table `refresh_tokens` will be added. If there are existing duplicate values, this will fail.
  - Made the column `session_id` on table `refresh_tokens` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."refresh_tokens" DROP CONSTRAINT "refresh_tokens_session_id_fkey";

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "session_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_session_id_key" ON "refresh_tokens"("session_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
