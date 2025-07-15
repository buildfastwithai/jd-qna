-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'PROFESSIONAL', 'EXPERT');

-- CreateEnum
CREATE TYPE "Requirement" AS ENUM ('MANDATORY', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "LikeStatus" AS ENUM ('LIKED', 'DISLIKED', 'NONE');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('TECHNICAL', 'FUNCTIONAL', 'BEHAVIORAL', 'COGNITIVE');

-- CreateTable
CREATE TABLE "SkillRecord" (
    "id" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reqId" INTEGER,
    "userId" INTEGER,
    "interviewLength" INTEGER,
    "rawJobDescription" TEXT,

    CONSTRAINT "SkillRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "floCareerId" INTEGER,
    "name" TEXT NOT NULL,
    "level" "SkillLevel" NOT NULL DEFAULT 'INTERMEDIATE',
    "requirement" "Requirement" NOT NULL DEFAULT 'OPTIONAL',
    "numQuestions" INTEGER NOT NULL DEFAULT 0,
    "difficulty" TEXT,
    "recordId" TEXT NOT NULL,
    "priority" INTEGER,
    "category" "SkillCategory" DEFAULT 'TECHNICAL',
    "questionFormat" TEXT DEFAULT 'Scenario based',

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "floCareerId" INTEGER,
    "content" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "liked" "LikeStatus" DEFAULT 'NONE',
    "feedback" TEXT,
    "coding" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalFeedback" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regeneration" (
    "id" TEXT NOT NULL,
    "originalQuestionId" TEXT NOT NULL,
    "newQuestionId" TEXT NOT NULL,
    "reason" TEXT,
    "userFeedback" TEXT,
    "liked" "LikeStatus" DEFAULT 'NONE',
    "skillId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Regeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcelQuestionSet" (
    "id" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "experienceRange" TEXT NOT NULL DEFAULT '8 to 10 years',
    "totalQuestions" INTEGER NOT NULL,
    "skillsExtracted" TEXT[],
    "recordId" TEXT,
    "rawJobDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcelQuestionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcelQuestion" (
    "id" TEXT NOT NULL,
    "slNo" INTEGER NOT NULL,
    "skill" TEXT NOT NULL,
    "questionTitle" TEXT NOT NULL,
    "questionDescription" TEXT NOT NULL,
    "idealAnswer" TEXT NOT NULL,
    "coding" BOOLEAN NOT NULL DEFAULT false,
    "setId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcelQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_recordId_key" ON "Skill"("name", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalFeedback_recordId_key" ON "GlobalFeedback"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "Regeneration_originalQuestionId_newQuestionId_key" ON "Regeneration"("originalQuestionId", "newQuestionId");

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "SkillRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "SkillRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalFeedback" ADD CONSTRAINT "GlobalFeedback_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "SkillRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Regeneration" ADD CONSTRAINT "Regeneration_originalQuestionId_fkey" FOREIGN KEY ("originalQuestionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Regeneration" ADD CONSTRAINT "Regeneration_newQuestionId_fkey" FOREIGN KEY ("newQuestionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Regeneration" ADD CONSTRAINT "Regeneration_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Regeneration" ADD CONSTRAINT "Regeneration_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "SkillRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcelQuestionSet" ADD CONSTRAINT "ExcelQuestionSet_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "SkillRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcelQuestion" ADD CONSTRAINT "ExcelQuestion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ExcelQuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
