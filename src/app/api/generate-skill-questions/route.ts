import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate prompt for a specific skill
const generatePrompt = (skillName: string, level: string) => {
  const difficultyLevel =
    level === "PROFESSIONAL"
      ? "advanced"
      : level === "INTERMEDIATE"
      ? "moderate"
      : "basic";

  return `Generate 1-2 interview questions for the skill "${skillName}" at a ${difficultyLevel} level.
The questions should be challenging but fair, testing both theoretical knowledge and practical application.

Format your response as a JSON object with a 'questions' key containing an array of question objects, where each object has:
1. A "question" field with the interview question
2. A "answer" field with a suggested model answer for the interviewer (should be comprehensive)
3. A "category" field with one of: "Technical", "Experience", "Problem Solving", or "Soft Skills"
4. A "difficulty" field with one of: "Easy", "Medium", or "Hard"
5. Prioritize questions that are Easy and Medium and are relevant to the skills and the level of the candidate`;
};

export async function POST(request: Request) {
  try {
    const { recordId, skillIds } = await request.json();

    if (!recordId || !skillIds || !Array.isArray(skillIds)) {
      return NextResponse.json(
        { success: false, error: "Record ID and skill IDs are required" },
        { status: 400 }
      );
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

    // Generate questions for each skill
    for (const skill of skills) {
      const prompt = generatePrompt(skill.name, skill.level);

      // Call OpenAI API
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert interviewer who creates relevant interview questions for specific technical skills. Include detailed suggested answers for each question.",
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
          // Add the skill ID to each question
          const questionsWithSkillId = parsedResponse.questions.map(
            (question: any) => ({
              ...question,
              skillId: skill.id,
            })
          );

          // Save questions to the database
          for (const question of questionsWithSkillId) {
            await prisma.question.create({
              data: {
                content: JSON.stringify({
                  question: question.question,
                  answer: question.answer,
                  category: question.category,
                  difficulty: question.difficulty,
                }),
                skillId: skill.id,
                recordId: recordId,
              },
            });
          }

          allQuestions.push(...questionsWithSkillId);
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
