import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate prompt for skills
const generatePrompt = (jobTitle: string, skills: any[]) => {
  const skillsFormatted = skills
    .map((skill) => `- ${skill.name} (Level: ${skill.level})`)
    .join("\n");

  return `Generate interview questions for the following skills for a ${jobTitle} position:

${skillsFormatted}

For each skill, generate at least one question that tests the candidate's knowledge and experience.
- For PROFESSIONAL level skills, create challenging, in-depth questions.
- For INTERMEDIATE level skills, create moderately difficult questions.
- For BEGINNER level skills, create basic but relevant questions.

Format your response as a JSON object with a 'questions' key containing an array of question objects, where each object has:
1. A "question" field with the interview question
2. A "answer" field with a suggested model answer for the interviewer
3. A "category" field with one of: "Technical", "Experience", "Problem Solving", or "Soft Skills"
4. A "difficulty" field with one of: "Easy", "Medium", or "Hard"
5. A "skillName" field that specifies which skill from the list this question is targeting (must match exactly one of the skill names provided)

Example:
{"questions": [
  {
    "question": "Can you describe your experience with deploying applications using Docker containers?",
    "answer": "A strong answer would demonstrate hands-on experience with Docker, including creating Dockerfiles, managing containers, using Docker Compose for multi-container applications, and understanding Docker networking and volumes. The candidate should explain specific projects where they've used Docker in production environments, challenges they faced, and how they solved them. Knowledge of Docker orchestration with Kubernetes or Docker Swarm would be a plus.",
    "category": "Technical",
    "difficulty": "Medium",
    "skillName": "Docker"
  }
]}`;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find the record with skills
    const record = await prisma.skillRecord.findUnique({
      where: { id },
      include: {
        skills: {
          where: { requirement: "MANDATORY" }, // Only generate for mandatory skills
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    if (record.skills.length === 0) {
      return NextResponse.json(
        { success: false, error: "No mandatory skills found" },
        { status: 400 }
      );
    }

    // Generate prompt
    const prompt = generatePrompt(record.jobTitle, record.skills);

    // Call OpenAI API
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert interviewer who creates relevant interview questions based on specific skills. Include detailed suggested answers for each question.",
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
      throw new Error("No response received from OpenAI");
    }

    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(questionsContent);

      // Check if the response has the expected format
      if (parsedResponse.questions && Array.isArray(parsedResponse.questions)) {
        const questions = parsedResponse.questions;

        // Create a map of skill names to ids
        const skillMap = new Map(
          record.skills.map((skill: any) => [skill.name.toLowerCase(), skill.id])
        );

        // Save questions to the database
        for (const question of questions) {
          const skillId = skillMap.get(question.skillName.toLowerCase());

          if (skillId) {
            await prisma.question.create({
              data: {
                content: JSON.stringify({
                  question: question.question,
                  answer: question.answer,
                  category: question.category,
                  difficulty: question.difficulty,
                }),
                skillId,
                recordId: id,
              },
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: `Generated ${questions.length} questions for ${record.jobTitle}`,
        });
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (error: any) {
      console.error("Error processing questions:", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to process questions",
        },
        { status: 500 }
      );
    }
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
