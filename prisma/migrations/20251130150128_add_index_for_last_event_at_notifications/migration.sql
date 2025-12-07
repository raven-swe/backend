-- DropIndex
DROP INDEX "public"."notifications_receiver_id_created_at_idx";

-- CreateIndex
CREATE INDEX "notifications_receiver_id_latest_event_at_id_idx" ON "notifications"("receiver_id", "latest_event_at" DESC, "id" DESC);

