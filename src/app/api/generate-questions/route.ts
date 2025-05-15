import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { SkillWithMetadata } from "@/components/JDQnaForm";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced prompt template for generating questions based on a specific skill
const generatePromptForSkill = (
  jobRole: string,
  jobDescription: string,
  skill: SkillWithMetadata,
  exactCount: number
) => {
  const difficultyLevel =
    skill.difficulty ||
    (skill.level === "PROFESSIONAL"
      ? "Hard"
      : skill.level === "INTERMEDIATE"
      ? "Medium"
      : "Easy");

  let prompt = `You are an expert interviewer for technical roles.
Based on the following job description for a ${jobRole} position, generate EXACTLY ${exactCount} relevant interview questions with suggested answers for the skill: ${skill.name}.

The questions should assess both technical knowledge and practical application of this skill.
The questions should be at a ${difficultyLevel} difficulty level.

Job Description:
${jobDescription}`;

  prompt += `\nFormat your response as a JSON object with a 'questions' key containing an array of question objects, where each object has:
1. A "question" field with the interview question
2. A "answer" field with a suggested model answer for the interviewer
3. A "category" field with one of: "Technical", "Experience", "Problem Solving", or "Soft Skills"
4. A "difficulty" field with "${difficultyLevel}"
5. A "skillName" field with "${skill.name}"

IMPORTANT: You must generate EXACTLY ${exactCount} unique questions, no more and no less.

Example:
{"questions": [
  {
    "question": "Can you describe your experience with deploying applications using Docker containers?",
    "answer": "A strong answer would demonstrate hands-on experience with Docker, including creating Dockerfiles, managing containers, using Docker Compose for multi-container applications, and understanding Docker networking and volumes. The candidate should explain specific projects where they've used Docker in production environments, challenges they faced, and how they solved them. Knowledge of Docker orchestration with Kubernetes or Docker Swarm would be a plus.",
    "category": "Technical",
    "difficulty": "${difficultyLevel}",
    "skillName": "${skill.name}"
  }
]}`;

  return prompt;
};

interface Question {
  question: string;
  answer: string;
  category: string;
  difficulty: string;
  skillName: string;
}

export async function POST(request: Request) {
  try {
    const { jobRole, jobDescription, skills, recordId, customInstructions } =
      await request.json();

    if (!jobRole || !jobDescription || !skills) {
      return NextResponse.json(
        { error: "Job role, description, and skills are required" },
        { status: 400 }
      );
    }

    // Filter for mandatory skills
    const mandatorySkills = skills.filter(
      (skill: SkillWithMetadata) => skill.requirement === "MANDATORY"
    );

    if (mandatorySkills.length === 0) {
      return NextResponse.json(
        { error: "No mandatory skills found" },
        { status: 400 }
      );
    }

    // Prepare to store all generated questions
    const allQuestions: Question[] = [];

    // Get all skills for this record to map skillName to skillId
    const dbSkills = recordId
      ? await prisma.skill.findMany({
          where: { recordId },
          select: { id: true, name: true },
        })
      : [];

    // Create a map of skill names to ids
    const skillMap = new Map(
      dbSkills.map((skill) => [skill.name.toLowerCase(), skill.id])
    );

    // Get existing questions for this record
    const existingQuestions = recordId
      ? await prisma.question.findMany({
          where: {
            recordId,
            skillId: {
              in: skillMap.keys() as any,
            },
          },
          select: {
            id: true,
            skillId: true,
          },
        })
      : [];

    // Create a map of skill IDs to existing question counts
    const existingQuestionCounts = new Map<string, number>();
    existingQuestions.forEach((question) => {
      const currentCount = existingQuestionCounts.get(question.skillId) || 0;
      existingQuestionCounts.set(question.skillId, currentCount + 1);
    });

    // Process each mandatory skill
    for (const skill of mandatorySkills) {
      const skillId = skillMap.get(skill.name.toLowerCase());

      if (!skillId) {
        console.log(`No skill ID found for ${skill.name}`);
        continue;
      }

      // Get requested questions count
      const totalQuestionsNeeded = skill.numQuestions || 1;

      // Get number of existing questions
      const existingCount = existingQuestionCounts.get(skillId) || 0;

      // Calculate how many more questions we need to generate
      const questionsToGenerate = Math.max(
        0,
        totalQuestionsNeeded - existingCount
      );

      // Skip if we already have enough questions
      if (questionsToGenerate <= 0) {
        console.log(
          `Skill ${skill.name} already has ${existingCount} questions. Skipping.`
        );
        continue;
      }

      console.log(
        `Generating ${questionsToGenerate} questions for skill ${skill.name}`
      );

      // Generate prompt for this skill with exact count needed
      const prompt = generatePromptForSkill(
        jobRole,
        jobDescription,
        skill,
        questionsToGenerate
      );

      // Call OpenAI API for this batch
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert interviewer who creates relevant interview questions based on job descriptions and specific skills. Include detailed suggested answers for each question. You MUST generate EXACTLY ${questionsToGenerate} unique questions, no more and no less.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const questionsContent = chatCompletion.choices[0]?.message?.content;

      if (!questionsContent) {
        console.error(
          `No response received from OpenAI for skill: ${skill.name}`
        );
        continue; // Skip to the next batch or skill
      }

      try {
        // Parse the JSON response
        const parsedResponse = JSON.parse(questionsContent);

        // Check if the response has the expected format
        if (
          parsedResponse.questions &&
          Array.isArray(parsedResponse.questions)
        ) {
          const questions: Question[] = parsedResponse.questions;

          // Add questions to our collection
          allQuestions.push(...questions);

          // If recordId is provided, save questions to the database
          if (recordId) {
            // For each question, create a record in the database
            for (const question of questions) {
              await prisma.question.create({
                data: {
                  content: JSON.stringify({
                    question: question.question,
                    answer: question.answer,
                    category: question.category,
                    difficulty: question.difficulty,
                  }),
                  skillId,
                  recordId,
                },
              });
            }
          }

          // After saving questions, update the count
          existingQuestionCounts.set(
            skillId,
            (existingQuestionCounts.get(skillId) || 0) + questions.length
          );
        } else {
          console.error(
            `Unexpected JSON structure for skill ${skill.name}:`,
            parsedResponse
          );
        }
      } catch (e) {
        console.error(
          `Error parsing or saving questions for skill ${skill.name}:`,
          e
        );
        // Continue to the next batch or skill
      }
    }

    return NextResponse.json({
      success: true,
      questions: allQuestions,
      recordId,
    });
  } catch (error: any) {
    console.error("Error generating questions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate questions",
      },
      { status: 500 }
    );
  }
}
