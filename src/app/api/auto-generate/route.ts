import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,

});

export async function POST(req: NextRequest) {
  try {
    const {
      jobRole,
      jobDescription,
      interviewLength = 60,
      customInstructions = "",
      reqId,
      userId,
    } = await req.json();

    if (!jobRole) {
      return NextResponse.json(
        { success: false, error: "Job role is required" },
        { status: 400 }
      );
    }

    if (!jobDescription) {
      return NextResponse.json(
        { success: false, error: "Job description is required" },
        { status: 400 }
      );
    }

    // Step 1: Create a skill record
    const record = await prisma.skillRecord.create({
      data: {
        jobTitle: jobRole,
        interviewLength: parseInt(String(interviewLength)),
        rawJobDescription: jobDescription,
        reqId: reqId ? parseInt(reqId) : null, // Convert to int if provided
        userId: userId ? parseInt(userId) : null, // Convert to int if provided
      },
    });

    // Step 2: Extract skills from job description using AI
    const skillsResponse = await extractSkillsWithAI(jobRole, jobDescription);

    if (!skillsResponse.success) {
      return NextResponse.json(
        {
          success: false,
          error: skillsResponse.error || "Failed to extract skills",
        },
        { status: 500 }
      );
    }

    const extractedSkills = skillsResponse.skills || [];

    // Step 3: Save extracted skills to the database
    const skills = await Promise.all(
      extractedSkills.map(async (skill: any, index: number) => {
        // Ensure at least the first 3 skills are mandatory with questions
        // and at least 1 question for the first 8 skills
        const isHighPriority = index < 3 || skill.importance === "high";
        const isOptional = !isHighPriority && index >= 3;
        const numQuestions = index < 8 ? (isOptional ? 1 : 2) : 0;
        const level = skill.level || "INTERMEDIATE";
        const category = skill.category || "TECHNICAL";

        // Create the skill
        return await prisma.skill.create({
          data: {
            name: skill.name,
            level: level,
            requirement: isOptional ? "OPTIONAL" : "MANDATORY",
            numQuestions: numQuestions,
            difficulty: skill.difficulty || "Medium",
            recordId: record.id,
            priority: index + 1,
            category: category,
            questionFormat: "Scenario",
          },
        });
      })
    );

    // Step 4: Generate questions for mandatory skills and optional skills with numQuestions > 0
    const skillsForQuestions = skills.filter(
      (skill) => skill.requirement === "MANDATORY" || skill.numQuestions > 0
    );

    // Skip if no skills need questions
    if (skillsForQuestions.length === 0) {
      console.log("No skills found for question generation");
      return NextResponse.json({
        success: true,
        recordId: record.id,
        message: "Skills extracted but no questions to generate",
      });
    }

    console.log(
      `Generating questions for ${skillsForQuestions.length} skills:`,
      skillsForQuestions.map((s) => `${s.name} (${s.numQuestions} questions)`)
    );

    // Calculate the total questions based on interview length
    const totalAvailableTime = interviewLength - 10; // Reserve 10 min for intro/wrap-up
    const avgTimePerQuestion = 4; // Average 4 minutes per question
    const maxQuestions = Math.floor(totalAvailableTime / avgTimePerQuestion);

    // Generate questions using AI
    const questionPrompt = `Generate interview questions for a ${jobRole} position based on these skills:
${skillsForQuestions
  .map(
    (skill, index) =>
      `${index + 1}. ${skill.name} (${skill.level} level, ${
        skill.difficulty
      } difficulty, ${skill.numQuestions} questions)`
  )
  .join("\n")}

Generate questions for each skill according to the number specified in parentheses. 

For each question, randomly choose one of these question formats and design the question accordingly:
1. "Open-ended" - Requires a descriptive or narrative answer. Useful for assessing communication, reasoning, or opinion-based responses.
2. "Coding" - Candidate writes or debugs code.
3. "Scenario" - Presents a short, realistic situation and asks how the candidate would respond or act. Tests decision-making, ethics, soft skills, or role-specific judgment.
4. "Case Study" - In-depth problem based on a real or simulated business/technical challenge. Requires analysis, synthesis of information, and a structured response. Often multi-step.
5. "Design" - Asks the candidate to architect a system, process, or solution. Often used in software/system design, business process optimization, or operational planning.
6. "Live Assessment" - Real-time tasks like pair programming, whiteboarding, or collaborative exercises. Tests real-world working ability and communication under pressure.

Each question should:
- Be relevant to the skill
- Match the appropriate difficulty level
- Include a detailed suggested answer for the interviewer
- Be categorized as either Technical, Experience, Problem Solving, or Soft Skills
- Follow the chosen question format
- Include a "coding" field set to true if questionFormat is "Coding", false otherwise.

IMPORTANT: FOR EACH SKILL, GENERATE EITHER ALL CODING QUESTIONS OR ALL NON-CODING QUESTIONS, NOT A MIX. ALWAYS DOUBLE CHECK THIS.

A Coding question means the candidate will write or debug code which will require code editor, so the "coding" field must be true.
A non-Coding question (Open-ended, Scenario, Case Study, Design, Live Assessment), means the candidate will explain the concept or process. NO CODING REQUIRED. So coding field must be false.

A "questionFormat" field that must be the same for all questions generated for a given skill: either "Coding" (for coding questions) or one of: "Open-ended", "Scenario", "Case Study", "Design", or "Live Assessment" (for non-coding questions).

IMPORTANT: The "coding" field must be set to true when questionFormat is "Coding".

${customInstructions ? `Additional instructions: ${customInstructions}` : ""}`;

    const questionsResponse = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are an expert interviewer creating relevant interview questions for a ${jobRole} position.
Format your response as a JSON array where each object has:
- question: The interview question
- answer: A comprehensive suggested answer for the interviewer
- skillName: The name of the skill this question tests (must match one of the provided skills exactly)
- category: One of: Technical, Experience, Problem Solving, Soft Skills, Functional, Behavioral, Cognitive
- difficulty: One of: Easy, Medium, Hard
- questionFormat: One of: Open-ended, Coding, Scenario, Case Study, Design, Live Assessment


Example:
{"questions": [
  {
    "question": "Can you describe your experience with deploying applications using Docker containers?",
    "answer": "A strong answer would demonstrate hands-on experience with Docker, including creating Dockerfiles, managing containers, using Docker Compose for multi-container applications, and understanding Docker networking and volumes. The candidate should explain specific projects where they've used Docker in production environments, challenges they faced, and how they solved them. Knowledge of Docker orchestration with Kubernetes or Docker Swarm would be a plus.",
    "category": "Technical",
    "difficulty": "Medium",
    "skillName": "Docker",
    "questionFormat": "Open-ended",
    "coding": false
  }
]}`,
        },
        { role: "user", content: questionPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = questionsResponse.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { success: false, error: "Failed to generate questions" },
        { status: 500 }
      );
    }

    // Parse the questions
    let questions = [];
    try {
      const parsedContent = JSON.parse(content);

      // Handle different possible formats
      if (Array.isArray(parsedContent)) {
        questions = parsedContent;
      } else if (
        parsedContent.questions &&
        Array.isArray(parsedContent.questions)
      ) {
        questions = parsedContent.questions;
      } else {
        throw new Error("Unexpected response format");
      }

      // Save questions to the database
      let savedQuestions = 0;
      for (const question of questions) {
        // Find the matching skill
        const skill = skills.find(
          (s) => s.name.toLowerCase() === question.skillName?.toLowerCase()
        );

        if (!skill) {
          console.log(
            `No matching skill found for question: ${question.skillName}`
          );
          continue;
        }

        await prisma.question.create({
          data: {
            content: JSON.stringify({
              question: question.question,
              answer: question.answer,
              category: question.category || "Technical",
              difficulty: question.difficulty || "Medium",
              questionFormat: question.questionFormat || "Scenario",
              coding: question.coding || false,
            }),
            skillId: skill.id,
            recordId: record.id,
          },
        });
        savedQuestions++;
      }

      console.log(`Successfully saved ${savedQuestions} questions to database`);
    } catch (error) {
      console.error("Error processing questions:", error);
      // Don't fail the entire request if question parsing fails
      console.log(
        "Continuing with skills only due to question generation error"
      );
    }

    // Get final counts for response
    const finalSkillCount = await prisma.skill.count({
      where: { recordId: record.id },
    });
    const finalQuestionCount = await prisma.question.count({
      where: { recordId: record.id },
    });

    return NextResponse.json({
      success: true,
      recordId: record.id,
      message: `Generated ${finalSkillCount} skills and ${finalQuestionCount} questions successfully`,
      skillCount: finalSkillCount,
      questionCount: finalQuestionCount,
    });
  } catch (error: any) {
    console.error("Error auto-generating:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to extract skills with AI
async function extractSkillsWithAI(jobRole: string, jobDescription: string) {
  try {
    // Call OpenAI to extract skills
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are a skilled recruiter analyzing job descriptions to extract required skills for interviews.
Extract skills from the job description and categorize them by:
- Importance: high (required) or low (preferred/optional)
- Level: BEGINNER, INTERMEDIATE, PROFESSIONAL, or EXPERT
- Category: TECHNICAL, FUNCTIONAL, BEHAVIORAL, or COGNITIVE
- Difficulty: Easy, Medium, or Hard

Return a JSON object with a 'skills' array, where each skill has:
- name: The skill name
- importance: high or low
- level: BEGINNER, INTERMEDIATE, PROFESSIONAL, or EXPERT
- category: TECHNICAL, FUNCTIONAL, BEHAVIORAL, or COGNITIVE
- difficulty: Easy, Medium, or Hard`,
        },
        {
          role: "user",
          content: `Job Title: ${jobRole}\n\nJob Description:\n${jobDescription}\n\nExtract the key skills needed for this role.`,
        },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    // Parse the response
    const data = JSON.parse(content);

    return {
      success: true,
      skills: data.skills || [],
    };
  } catch (error: any) {
    console.error("Error extracting skills with AI:", error);
    return {
      success: false,
      error: error.message || "Failed to extract skills with AI",
    };
  }
}
