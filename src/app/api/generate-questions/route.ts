import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate prompt for a specific skill batch
const generatePrompt = (
  skillName: string,
  level: string,
  difficulty: string,
  batchSize: number = 5
) => {
  // Map skill level to difficulty if not provided
  const effectiveDifficulty =
    difficulty ||
    (level === "PROFESSIONAL"
      ? "Hard"
      : level === "INTERMEDIATE"
      ? "Medium"
      : "Easy");

  return `Generate exactly ${batchSize} interview questions for the skill "${skillName}" at a ${level} level (${effectiveDifficulty} difficulty).
The questions should be challenging but fair, testing both theoretical knowledge and practical application.

For each question, randomly choose one of these question formats and design the question accordingly:
1. "Open-ended" - Requires a descriptive or narrative answer. Useful for assessing communication, reasoning, or opinion-based responses.
2. "Coding" - Candidate writes or debugs code. Used for evaluating problem-solving skills, algorithms, and programming language proficiency.
3. "Scenario" - Presents a short, realistic situation and asks how the candidate would respond or act. Tests decision-making, ethics, soft skills, or role-specific judgment.
4. "Case Study" - In-depth problem based on a real or simulated business/technical challenge. Requires analysis, synthesis of information, and a structured response. Often multi-step.
5. "Design" - Asks the candidate to architect a system, process, or solution. Often used in software/system design, business process optimization, or operational planning.
6. "Live Assessment" - Real-time tasks like pair programming, whiteboarding, or collaborative exercises. Tests real-world working ability and communication under pressure.

Format your response as a JSON object with a 'questions' key containing an array of question objects, where each object has:
1. A "question" field with the interview question
2. A "answer" field with a suggested model answer for the interviewer (should be comprehensive)
3. A "category" field with one of: "Technical", "Experience", "Problem Solving", or "Soft Skills"
4. A "difficulty" field with "${effectiveDifficulty}"
5. A "skillName" field with "${skillName}"
6. A "coding" field with a boolean value: true if the questionFormat is "Coding" , false otherwise

IMPORTANT: The "coding" field must be set to true when questionFormat is "Coding".

IMPORTANT: For each skill, generate either all coding questions or all non-coding questions, not a mix.

A "questionFormat" field that must be the same for all questions generated for a given skill: either "Coding" (for coding questions) or one of: "Open-ended", "Scenario", "Case Study", "Design", or "Live Assessment" (for non-coding questions).

Make sure the questions match the specified difficulty level and are appropriate for the skill.
IMPORTANT: You must generate exactly ${batchSize} unique questions, no more and no less.`;
};

interface SkillMetadata {
  id: string;
  numQuestions?: number;
  difficulty?: string;
}

export async function POST(request: Request) {
  try {
    const { recordId, skillIds, skills: skillsMetadata } = await request.json();

    if (!recordId || !skillIds || !Array.isArray(skillIds)) {
      return NextResponse.json(
        { success: false, error: "Record ID and skill IDs are required" },
        { status: 400 }
      );
    }

    // Create a map of skill ID to metadata if provided
    const metadataMap = new Map<string, SkillMetadata>();
    if (skillsMetadata && Array.isArray(skillsMetadata)) {
      skillsMetadata.forEach((meta: SkillMetadata) => {
        if (meta.id) {
          metadataMap.set(meta.id, meta);
        }
      });
    }

    // Get the skills from the database
    const skills = await prisma.skill.findMany({
      where: {
        id: { in: skillIds },
        recordId: recordId,
      },
    });

    if (skills.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid skills found" },
        { status: 404 }
      );
    }

    const allQuestions = [];

    // First, check how many questions already exist for each skill
    const existingQuestions = await prisma.question.findMany({
      where: {
        skillId: { in: skillIds },
        recordId: recordId,
      },
      select: {
        id: true,
        skillId: true,
      },
    });

    // Create a map of skill IDs to existing question counts
    const existingQuestionCounts = new Map<string, number>();
    existingQuestions.forEach((question) => {
      const currentCount = existingQuestionCounts.get(question.skillId) || 0;
      existingQuestionCounts.set(question.skillId, currentCount + 1);
    });

    // Generate questions for each skill in batches
    for (const skill of skills) {
      // Get metadata for this skill (if provided)
      const metadata = metadataMap.get(skill.id);

      // Determine how many questions to generate
      const requestedQuestions =
        metadata?.numQuestions || skill.numQuestions || 1;

      // Get number of existing questions
      const existingCount = existingQuestionCounts.get(skill.id) || 0;

      // Calculate how many more questions we need to generate
      const questionsToGenerate = Math.max(
        0,
        requestedQuestions - existingCount
      );

      // Skip if we already have enough questions
      if (questionsToGenerate <= 0) {
        console.log(
          `Skill ${skill.name} already has ${existingCount} questions. Skipping.`
        );
        continue;
      }

      // Get the difficulty (from metadata, skill, or based on level)
      const difficulty = metadata?.difficulty || skill.difficulty;

      // Process in batches of max 5
      const batchSize = Math.min(5, questionsToGenerate);

      // Generate the exact number of questions needed
      console.log(
        `Generating ${questionsToGenerate} questions for skill ${skill.name}`
      );

      // Generate prompt for this batch
      const prompt = generatePrompt(
        skill.name,
        skill.level,
        difficulty as any,
        questionsToGenerate
      );

      // Call OpenAI API
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `You are an expert interviewer who creates relevant interview questions for specific technical skills. Include detailed suggested answers for each question. You MUST generate EXACTLY ${questionsToGenerate} unique questions, no more and no less.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const content = chatCompletion.choices[0]?.message?.content;

      if (!content) {
        console.error(
          `No response received from OpenAI for skill: ${skill.name}`
        );
        continue;
      }

      try {
        const parsedResponse = JSON.parse(content);

        if (
          parsedResponse.questions &&
          Array.isArray(parsedResponse.questions)
        ) {
          // Ensure we only process the exact number needed
          const questionsToProcess = parsedResponse.questions.slice(
            0,
            questionsToGenerate
          );

          // Add the skill ID to each question
          const questionsWithSkillId = questionsToProcess.map(
            (question: any) => ({
              ...question,
              skillId: skill.id,
            })
          );

          // Save questions to the database
          for (const question of questionsWithSkillId) {
            // Ensure coding flag is properly set
            const isCoding =
              question.coding === true ||
              question.questionFormat?.toLowerCase() === "coding" ||
              (question.question &&
                question.question.toLowerCase().includes("code")) ||
              (question.question &&
                question.question.toLowerCase().includes("algorithm")) ||
              (question.question &&
                question.question.toLowerCase().includes("programming"));

            await prisma.question.create({
              data: {
                content: JSON.stringify({
                  question: question.question,
                  answer: question.answer,
                  category: question.category,
                  difficulty: question.difficulty,
                  questionFormat: question.questionFormat || "Scenario",
                  coding: isCoding,
                }),
                skillId: skill.id,
                recordId: recordId,
                coding: isCoding,
              },
            });
          }

          allQuestions.push(...questionsWithSkillId);

          // Update the existing question count for this skill
          existingQuestionCounts.set(
            skill.id,
            (existingQuestionCounts.get(skill.id) || 0) +
              questionsWithSkillId.length
          );
        }
      } catch (e) {
        console.error(`Error parsing questions for skill ${skill.name}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      questions: allQuestions,
    });
  } catch (error: any) {
    console.error("Error generating skill questions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate skill questions",
      },
      { status: 500 }
    );
  }
}
