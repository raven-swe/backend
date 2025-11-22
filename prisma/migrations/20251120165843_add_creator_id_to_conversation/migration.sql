-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "creator_id" BIGINT NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
