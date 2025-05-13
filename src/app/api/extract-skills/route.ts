import { NextResponse } from "next/server";
import OpenAI from "openai";
import { SkillLevel, Requirement } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prompt to extract skills from job description with level and requirement
const generatePrompt = (jobDescription: string) => {
  return `Extract all technical skills, frameworks, libraries, tools, and technologies from the following job description.
For each skill, determine:
1. Skill Level: BEGINNER, INTERMEDIATE, or PROFESSIONAL based on the complexity or expertise required
2. Requirement: MANDATORY or OPTIONAL based on how essential it is for the role

Return the result as a JSON object with an array called 'skills', where each item has these properties:
- name: The skill name
- level: One of "BEGINNER", "INTERMEDIATE", or "PROFESSIONAL"
- requirement: Either "MANDATORY" or "OPTIONAL"

Be comprehensive and include all relevant technical skills mentioned.

Job Description:
${jobDescription}

Format your response as a JSON object like this:
{
  "skills": [
    { "name": "JavaScript", "level": "PROFESSIONAL", "requirement": "MANDATORY" },
    { "name": "React", "level": "INTERMEDIATE", "requirement": "MANDATORY" },
    { "name": "Docker", "level": "BEGINNER", "requirement": "OPTIONAL" }
  ]
}`;
};

export interface SkillWithMetadata {
  name: string;
  level: SkillLevel;
  requirement: Requirement;
}

export async function POST(request: Request) {
  try {
    const { jobDescription, jobTitle } = await request.json();

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
            "You are a technical recruiter who can identify skills from job descriptions and determine their required expertise level and importance.",
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

      // Check if the response has the expected format
      if (parsedResponse.skills && Array.isArray(parsedResponse.skills)) {
        let skillRecord: any = null;

        // If jobTitle is provided, create a record in the database
        if (jobTitle) {
          skillRecord = await prisma.skillRecord.create({
            data: {
              jobTitle,
            },
          });

          // Create skills with metadata
          if (skillRecord) {
            await prisma.skill.createMany({
              data: parsedResponse.skills.map((skill: SkillWithMetadata) => ({
                name: skill.name,
                level: skill.level,
                requirement: skill.requirement,
                recordId: skillRecord.id,
              })),
            });
          }
        }

        return NextResponse.json({
          success: true,
          skills: parsedResponse.skills,
          recordId: skillRecord?.id,
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
