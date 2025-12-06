/*
  Warnings:

  - A unique constraint covering the columns `[dedupe_key]` on the table `notifications` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fcm_token]` on the table `user_devices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[device_id]` on the table `user_devices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `device_id` to the `user_devices` table without a default value. This is not possible if the table is not empty.
  - Made the column `fcm_token` on table `user_devices` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'INVALID_TOKEN');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupe_key" VARCHAR(255),
ADD COLUMN     "is_aggregated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latest_event_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "opened_at" TIMESTAMP(3);


-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" BIGSERIAL NOT NULL,
    "notification_id" BIGINT NOT NULL,
    "device_id" BIGINT NOT NULL,
    "fcm_message_id" TEXT,
    "status" "NotificationDeliveryStatus" NOT NULL,
    "responseBody" JSONB,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

