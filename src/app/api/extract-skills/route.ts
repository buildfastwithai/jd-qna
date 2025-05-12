import { NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prompt to extract skills from job description
const generatePrompt = (jobDescription: string) => {
  return `Extract all technical skills, frameworks, libraries, tools, and technologies from the following job description. 
Return the result as a JSON array of strings containing only the skill names. 
Be comprehensive and include all relevant technical skills mentioned.

Job Description:
${jobDescription}

Format your response as a JSON array of strings. For example:
["JavaScript", "React", "Node.js", "TypeScript", "AWS"]`;
};

export async function POST(request: Request) {
  try {
    const { jobDescription } = await request.json();

    if (!jobDescription) {
      return NextResponse.json(
        { success: false, error: "Job description is required" },
        { status: 400 }
      );
    }

    const prompt = generatePrompt(jobDescription);

    // Call OpenAI API
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a technical recruiter who can identify skills from job descriptions.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const skillsContent = chatCompletion.choices[0]?.message?.content;

    if (!skillsContent) {
      throw new Error("No response received from OpenAI");
    }

    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(skillsContent);

      // Check if the response has the expected format (an array of skills)
      if (parsedResponse.skills && Array.isArray(parsedResponse.skills)) {
        return NextResponse.json({
          success: true,
          skills: parsedResponse.skills,
        });
      } else if (Array.isArray(parsedResponse)) {
        // Handle case where response is a direct array
        return NextResponse.json({
          success: true,
          skills: parsedResponse,
        });
      } else {
        // If we have JSON but not in the expected format
        console.error("Unexpected JSON structure:", parsedResponse);
        return NextResponse.json(
          {
            success: false,
            error: "Unexpected response format",
            rawContent: skillsContent,
          },
          { status: 500 }
        );
      }
    } catch (e) {
      console.error("Error parsing skills:", e);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse skills",
          rawContent: skillsContent,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error extracting skills:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to extract skills",
      },
      { status: 500 }
    );
  }
}
