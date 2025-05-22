import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { SkillWithMetadata } from "@/components/JDQnaForm";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced prompt template for generating questions
const generatePrompt = (
  jobDescription: string,
  skills: SkillWithMetadata[],
  previousQuestions?: any[]
) => {
  let prompt = `You are an expert interviewer for technical roles.
Based on the following job description, generate relevant interview questions for each of the provided skills.

Job Description:
${jobDescription || "No job description provided"}

Skills:
${skills
  .map((s) => `- ${s.name} (Level: ${s.level}, Requirement: ${s.requirement})`)
  .join("\n")}

`;

  if (previousQuestions && previousQuestions.length > 0) {
    prompt += `\nThe following questions were previously generated. Consider the feedback provided:
${previousQuestions
  .map(
    (q, i) =>
      `${i + 1}. "${q.question}" (Skill: ${q.skill})
   - Liked: ${q.liked ? "Yes" : "No"}
   - Disliked: ${q.disliked ? "Yes" : "No"}
   - Feedback: ${q.feedback || "None"}`
  )
  .join("\n\n")}

Based on this feedback, generate new and improved questions.
`;
  }

  prompt += `\nFormat your response as a JSON object with:
1. A "success" field set to true
2. A "questions" array containing objects with:
   - "skill" field with the skill name
   - "question" field with the interview question
   - "level" field with the difficulty level

Generate 2-3 questions per skill, prioritizing mandatory skills.

Example:
{
  "success": true,
  "questions": [
    {
      "skill": "JavaScript",
      "question": "Can you explain the concept of closures in JavaScript and provide a practical example?",
      "level": "MEDIUM"
    },
    {
      "skill": "React",
      "question": "How would you optimize performance in a React application that renders a large list of items?",
      "level": "HARD"
    }
  ]
}`;

  return prompt;
};

export async function POST(request: Request) {
  try {
    // Parse the request body
    const json = await request.json();
    let data;

    // Handle both direct string input and JSON object input for compatibility
    if (typeof json === "string") {
      try {
        // If the input is a JSON string, try to parse it
        data = JSON.parse(json);
      } catch (e) {
        return NextResponse.json(
          { success: false, error: "Invalid JSON input" },
          { status: 400 }
        );
      }
    } else {
      // If the input is already an object, use it directly
      data = json;
    }

    const { jobDescription, skills, previousQuestions } = data;

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return NextResponse.json(
        { success: false, error: "Skills are required and must be an array" },
        { status: 400 }
      );
    }

    // Generate prompt
    const prompt = generatePrompt(jobDescription, skills, previousQuestions);

    // Call OpenAI API
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert interviewer who creates relevant interview questions based on job descriptions and specific skills. Generate thoughtful questions that can assess both technical knowledge and practical application.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response received from OpenAI");
    }

    // For Vercel AI SDK, just return the raw response content
    return new Response(responseContent);
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
