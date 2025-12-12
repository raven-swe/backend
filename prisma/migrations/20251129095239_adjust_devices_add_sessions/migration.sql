/*
  Warnings:

  - A unique constraint covering the columns `[device_id]` on the table `user_devices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fcm_token]` on the table `user_devices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `device_id` to the `user_devices` table without a default value. This is not possible if the table is not empty.
  - Made the column `fcm_token` on table `user_devices` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "session_id" BIGINT,
ALTER COLUMN "device_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user_devices"
ADD COLUMN     "push_enabled" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "user_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "sessions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "user_agent" TEXT,
    "ip_address" INET,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX "user_devices_fcm_token_key" ON "user_devices"("fcm_token");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
