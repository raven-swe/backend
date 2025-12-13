
-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "payload" JSONB;


-- CreateIndex
CREATE INDEX "notifications_receiver_id_dedupe_key_seen_idx" ON "notifications"("receiver_id", "dedupe_key", "seen");
