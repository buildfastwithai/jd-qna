import { NextResponse } from "next/server";
import OpenAI from "openai";
import { SkillLevel, Requirement } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced prompt to extract comprehensive job information
const generatePrompt = (jobDescription: string) => {
  return `# Job Description Skill Analyzer

Please analyze the following job description and extract the information in a structured format:

## 1. General Information
Extract the following:
- Job Title
- Experience Required (years)
- Company/Department

## 2. Skill Matrix
Extract all technical skills, frameworks, libraries, tools, and technologies mentioned extract upto 10 skills do not exceed 10 skills.
For each skill, determine:
- Level: BEGINNER, INTERMEDIATE or PROFESSIONAL based on the complexity or expertise required
- Requirement: MANDATORY or OPTIONAL based on how essential it is for the role
- For 20-30% of skills add softskills grouped into categories like communication, leadership, problem-solving, etc.

Level definitions:
- BEGINNER: Fundamental understanding, entry-level proficiency
- INTERMEDIATE: Working knowledge with some practical experience
- PROFESSIONAL: Strong command and practical application experience

Requirement definitions:
- MANDATORY: Essential for the role
- OPTIONAL: Nice to have, but not essential

Job Description:
${jobDescription}

Format your response as a JSON object like this:
{
  "skills": [
    { "name": "JavaScript", "level": "PROFESSIONAL", "requirement": "MANDATORY" },
    { "name": "React", "level": "INTERMEDIATE", "requirement": "MANDATORY" },
    { "name": "Docker", "level": "BEGINNER", "requirement": "OPTIONAL" }
  ],
}`;
};

export interface SkillWithMetadata {
  name: string;
  level: SkillLevel;
  requirement: Requirement;
  numQuestions: number;
  difficulty?: string;
  priority?: number;
}

export interface JobAnalysis {
  generalInfo: {
    jobTitle: string;
    experienceRequired: string;
    companyDepartment: string;
  };
  skills: SkillWithMetadata[];
  keyResponsibilities: string[];
  otherRequirements: string[];
  summary: string;
}

export async function POST(request: Request) {
  try {
    const {
      jobDescription,
      jobTitle: providedJobTitle,
      interviewLength,
      reqId,
      userId,
      minExperience,
      maxExperience,
    } = await request.json();

    if (!jobDescription) {
      return NextResponse.json(
        { success: false, error: "Job description is required" },
        { status: 400 }
      );
    }

    const prompt = generatePrompt(jobDescription);

    // Call OpenAI API
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are a technical recruiter who can thoroughly analyze job descriptions to extract comprehensive information including skills, experience requirements, responsibilities, and qualifications. Extract upto 10 skills strictly. Group similar skills or alternatives into a single skill. Do not include skills that are not mentioned in the job description. Do not include skills that are not relevant to the job description. Only mention Technical skills and not soft skills. Do not exceed 10-12 skills. Do not include skills that are not mentioned in the job description. Do not include skills that are not relevant to the job description. Only mention Technical skills and some soft skills.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const analysisContent = chatCompletion.choices[0]?.message?.content;

    if (!analysisContent) {
      throw new Error("No response received from OpenAI");
    }

    try {
      // Parse the JSON response
      const parsedResponse: JobAnalysis = JSON.parse(analysisContent);

      // Check if the response has the expected format
      if (parsedResponse.skills && Array.isArray(parsedResponse.skills)) {
        let skillRecord: any = null;

        // Use the extracted job title or the provided one
        const jobTitle =
          providedJobTitle || parsedResponse.generalInfo.jobTitle;

        // If jobTitle is provided, create a record in the database
        if (jobTitle) {
          // Store data with the new fields including reqId and userId
          skillRecord = await prisma.skillRecord.create({
            data: {
              jobTitle,
              interviewLength: interviewLength || 60, // Default to 60 minutes if not provided
              rawJobDescription: jobDescription, // Store the raw job description
              reqId: reqId ? parseInt(reqId) : null, // Convert to int if provided
              userId: userId ? parseInt(userId) : null, // Convert to int if provided
            },
          });

          // Create skills with metadata and priorities
          if (skillRecord) {
            // Sort mandatory skills first, then optional
            const sortedSkills = [
              ...parsedResponse.skills.filter(
                (skill) => skill.requirement === "MANDATORY"
              ),
              ...parsedResponse.skills.filter(
                (skill) => skill.requirement === "OPTIONAL"
              ),
            ];

            // Add priority based on order
            await prisma.skill.createMany({
              data: sortedSkills.map(
                (skill: SkillWithMetadata, index: number) => ({
                  name: skill.name,
                  level: skill.level,
                  requirement: skill.requirement,
                  numQuestions: skill.requirement === "MANDATORY" ? 1 : 0, // Default to 1 question
                  difficulty: "Medium", // Default to Medium difficulty
                  recordId: skillRecord.id,
                  priority: index + 1, // Priority based on sorted order
                })
              ),
            });
          }
        }

        return NextResponse.json({
          success: true,
          analysis: parsedResponse,
          recordId: skillRecord?.id,
        });
      } else {
        // If we have JSON but not in the expected format
        console.error("Unexpected JSON structure:", parsedResponse);
        return NextResponse.json(
          {
            success: false,
            error: "Unexpected response format",
            rawContent: analysisContent,
          },
          { status: 500 }
        );
      }
    } catch (e) {
      console.error("Error parsing analysis:", e);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse analysis",
          rawContent: analysisContent,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error analyzing job description:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to analyze job description",
      },
      { status: 500 }
    );
  }
}
