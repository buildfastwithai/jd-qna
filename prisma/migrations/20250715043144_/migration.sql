/*
  Warnings:

  - The values [CODING] on the enum `SkillCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SkillCategory_new" AS ENUM ('TECHNICAL', 'FUNCTIONAL', 'BEHAVIORAL', 'COGNITIVE');
ALTER TABLE "Skill" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Skill" ALTER COLUMN "category" TYPE "SkillCategory_new" USING ("category"::text::"SkillCategory_new");
ALTER TYPE "SkillCategory" RENAME TO "SkillCategory_old";
ALTER TYPE "SkillCategory_new" RENAME TO "SkillCategory";
DROP TYPE "SkillCategory_old";
ALTER TABLE "Skill" ALTER COLUMN "category" SET DEFAULT 'TECHNICAL';
COMMIT;
