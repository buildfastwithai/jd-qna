import { NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Sample prompt template for generating questions
const generatePrompt = (
  jobRole: string,
  jobDescription: string,
  customInstructions?: string
) => {
  let prompt = `You are an expert interviewer for technical roles.
Based on the following job description for a ${jobRole} position, generate 8-10 relevant interview questions with suggested answers.
The questions should assess both technical knowledge and soft skills relevant to the role.
Each question should be challenging but fair, focusing on the key requirements in the job description.

Job Description:
${jobDescription}
`;

  if (customInstructions) {
    prompt += `\nAdditional Instructions:
${customInstructions}
`;
  }

  prompt += `\nFormat your response as a JSON object with a 'questions' key containing an array of question objects, where each object has:
1. A "question" field with the interview question
2. A "answer" field with a suggested model answer for the interviewer
3. A "category" field with one of: "Technical", "Experience", "Problem Solving", or "Soft Skills"
4. A "difficulty" field with one of: "Easy", "Medium", or "Hard"

Example:
{"questions": [
  {
    "question": "Can you describe your experience with deploying applications using Docker containers?",
    "answer": "A strong answer would demonstrate hands-on experience with Docker, including creating Dockerfiles, managing containers, using Docker Compose for multi-container applications, and understanding Docker networking and volumes. The candidate should explain specific projects where they've used Docker in production environments, challenges they faced, and how they solved them. Knowledge of Docker orchestration with Kubernetes or Docker Swarm would be a plus.",
    "category": "Technical",
    "difficulty": "Medium"
  }
]}`;

  return prompt;
};

export async function POST(request: Request) {
  try {
    const { jobRole, jobDescription, customInstructions } =
      await request.json();

    if (!jobRole || !jobDescription) {
      return NextResponse.json(
        { error: "Job role and description are required" },
        { status: 400 }
      );
    }

    const prompt = generatePrompt(jobRole, jobDescription, customInstructions);

    // Call OpenAI API using the client
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert interviewer who creates relevant interview questions based on job descriptions. Include detailed suggested answers for each question.",
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
        return NextResponse.json({
          success: true,
          questions: parsedResponse.questions,
        });
      } else if (Array.isArray(parsedResponse)) {
        // Handle case where response is a direct array
        return NextResponse.json({
          success: true,
          questions: parsedResponse,
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
      console.error("Error parsing questions:", e);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse questions",
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
