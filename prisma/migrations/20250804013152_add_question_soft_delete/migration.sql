-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedFeedback" TEXT;
