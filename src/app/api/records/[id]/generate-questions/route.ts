import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate prompt for skills
const generatePrompt = (
  jobTitle: string,
  skills: any[],
  questionsPerSkill: Map<string, number>
) => {
  const skillsFormatted = skills
    .map((skill) => {
      const numQuestions = questionsPerSkill.get(skill.id) || 0;
      if (numQuestions <= 0) return null; // Skip skills that don't need questions

      return `- ${skill.name} (Level: ${skill.level}, Difficulty: ${
        skill.difficulty || "Medium"
      }, Questions: ${numQuestions})`;
    })
    .filter(Boolean) // Remove null entries
    .join("\n");

  return `Generate interview questions for the following skills for a ${jobTitle} position.
IMPORTANT: Generate the EXACT number of questions specified for each skill - no more, no less.

${skillsFormatted}

Create questions that test the candidate's knowledge and experience:
- For PROFESSIONAL level skills, create challenging, in-depth questions.
- For INTERMEDIATE level skills, create moderately difficult questions.
- For BEGINNER level skills, create basic but relevant questions.

Format your response as a JSON object with a 'questions' key containing an array of question objects, where each object has:
1. A "question" field with the interview question
2. A "answer" field with a suggested model answer for the interviewer
3. A "category" field with one of: "Technical", "Experience", "Problem Solving", or "Soft Skills"
4. A "difficulty" field matching the skill's specified difficulty
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
]}

IMPORTANT: You must generate the EXACT number of questions requested for each skill - no more, no less.`;
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

    // Get existing questions
    const existingQuestions = await prisma.question.findMany({
      where: {
        recordId: id,
        skillId: {
          in: record.skills.map((skill: any) => skill.id),
        },
      },
      select: {
        skillId: true,
      },
    });

    // Count existing questions per skill
    const existingQuestionCounts = new Map<string, number>();
    existingQuestions.forEach((question) => {
      const currentCount = existingQuestionCounts.get(question.skillId) || 0;
      existingQuestionCounts.set(question.skillId, currentCount + 1);
    });

    // Store all generated questions
    const allGeneratedQuestions = [];
    let totalQuestionsGenerated = 0;

    // Process each skill individually
    for (const skill of record.skills) {
      const requestedCount = skill.numQuestions || 1;
      const existingCount = existingQuestionCounts.get(skill.id) || 0;
      const neededCount = Math.max(0, requestedCount - existingCount);

      // Skip if no questions needed for this skill
      if (neededCount <= 0) {
        console.log(
          `Skill ${skill.name} already has ${existingCount} questions. Skipping.`
        );
        continue;
      }

      console.log(
        `Generating ${neededCount} questions for skill ${skill.name}`
      );

      // Create a map with just this skill
      const questionsToGenerate = new Map<string, number>();
      questionsToGenerate.set(skill.id, neededCount);

      // Generate prompt for only this skill
      const prompt = generatePrompt(
        record.jobTitle,
        [skill], // Pass only the current skill
        questionsToGenerate
      );

      // Call OpenAI API for this skill
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert interviewer who creates relevant interview questions based on specific skills. Include detailed suggested answers for each question. You must generate EXACTLY ${neededCount} unique questions for the skill "${skill.name}" - no more, no less.`,
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
        continue;
      }

      try {
        // Parse the JSON response
        const parsedResponse = JSON.parse(questionsContent);

        // Check if the response has the expected format
        if (
          parsedResponse.questions &&
          Array.isArray(parsedResponse.questions)
        ) {
          const questions = parsedResponse.questions.slice(0, neededCount); // Ensure we only take what we need

          // Create a map of skill names to ids (just for this skill)
          const skillId = skill.id;
          const skillName = skill.name.toLowerCase();

          // Save questions to the database
          for (const question of questions) {
            // Create the question
            const createdQuestion = await prisma.question.create({
              data: {
                content: JSON.stringify({
                  question: question.question,
                  answer: question.answer,
                  category: question.category,
                  difficulty:
                    question.difficulty || skill.difficulty || "Medium",
                }),
                skillId: skillId,
                recordId: id,
              },
            });

            // Add this question to our collection with all metadata
            allGeneratedQuestions.push({
              ...question,
              id: createdQuestion.id,
              skillId: skillId,
              skillName: skill.name,
            });
          }

          // Update count of total questions generated
          totalQuestionsGenerated += questions.length;

          // Update the existing count for next skills
          existingQuestionCounts.set(
            skillId,
            (existingQuestionCounts.get(skillId) || 0) + questions.length
          );
        } else {
          console.error(`Unexpected response format for skill ${skill.name}`);
        }
      } catch (error: any) {
        console.error(
          `Error processing questions for skill ${skill.name}:`,
          error
        );
        // Continue with the next skill
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${totalQuestionsGenerated} questions across ${record.skills.length} skills for ${record.jobTitle}`,
      questions: allGeneratedQuestions,
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
