-- AlterTable
ALTER TABLE "users" ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[];
