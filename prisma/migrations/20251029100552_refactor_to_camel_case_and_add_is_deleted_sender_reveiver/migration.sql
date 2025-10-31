-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "is_deleted_receiver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_deleted_sender" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "media_url" TEXT;