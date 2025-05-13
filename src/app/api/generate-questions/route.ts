import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { SkillWithMetadata } from "@/components/JDQnaForm";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced prompt template for generating questions based on skills with metadata
const generatePrompt = (
  jobRole: string,
  jobDescription: string,
  skills: SkillWithMetadata[],
  customInstructions?: string
) => {
  // Filter for mandatory skills
  const mandatorySkills = skills
    .filter((skill) => skill.requirement === "MANDATORY")
    .map((skill) => ({
      name: skill.name,
      level: skill.level,
    }));

  const skillsFormatted = mandatorySkills
    .map((skill) => `- ${skill.name} (Level: ${skill.level})`)
    .join("\n");

  let prompt = `You are an expert interviewer for technical roles.
Based on the following job description for a ${jobRole} position, generate relevant interview questions with suggested answers.
Focus specifically on these MANDATORY skills with their required proficiency levels:

${skillsFormatted}

The questions should assess both technical knowledge and practical application of these skills.
Each question's difficulty should align with the specified proficiency level for the skill.
For PROFESSIONAL level skills, create challenging, in-depth questions.
For INTERMEDIATE level skills, create moderately difficult questions.
For BEGINNER level skills, create basic but relevant questions.

Job Description:
${jobDescription}
`;

  if (customInstructions) {
    prompt += `\nAdditional Instructions:
${customInstructions}
`;
  }

  prompt += `\nFor each skill, generate at least one dedicated question.
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

    const prompt = generatePrompt(
      jobRole,
      jobDescription,
      skills,
      customInstructions
    );

    // Call OpenAI API using the client
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert interviewer who creates relevant interview questions based on job descriptions and specific skills. Include detailed suggested answers for each question.",
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
        const questions: Question[] = parsedResponse.questions;

        // If recordId is provided, save questions to the database
        if (recordId) {
          // Get all skills for this record to map skillName to skillId
          const dbSkills = await prisma.skill.findMany({
            where: { recordId },
            select: { id: true, name: true },
          });

          // Create a map of skill names to ids
          const skillMap = new Map(
            dbSkills.map((skill) => [skill.name.toLowerCase(), skill.id])
          );

          // For each question, find the corresponding skill and create the question
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
                  recordId,
                },
              });
            }
          }
        }

        return NextResponse.json({
          success: true,
          questions: questions,
          recordId,
        });
      } else {
        // If we have JSON but not in the expected format
        console.error("Unexpected JSON structure:", parsedResponse);
        return NextResponse.json(
          {
            success: false,
            error: "Unexpected response format",
            rawContent: questionsContent,
          },
          { status: 500 }
        );
      }
    } catch (e) {
      console.error("Error parsing or saving questions:", e);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to process questions",
          rawContent: questionsContent,
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
