import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { getLogger } from "@/lib/logger";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 1200000,
});

// Generate prompt for a single question with strict feedback handling
const generateSingleQuestionPrompt = (
  skillName: string,
  level: string,
  difficulty: string,
  feedback: string,
  existingQuestions: string[] = [],
  forceCoding: boolean = false
) => {
  // Map skill level to difficulty if not provided
  const effectiveDifficulty =
    difficulty ||
    (level === "PROFESSIONAL"
      ? "Hard"
      : level === "INTERMEDIATE"
      ? "Medium"
      : "Easy");

  // Format feedback section - make it very strict
  const feedbackSection = feedback
    ? `\n\nCRITICAL FEEDBACK - YOU MUST FOLLOW THIS STRICTLY:\n"${feedback}"\n\nIMPORTANT: The new question MUST address and incorporate this feedback. This feedback is non-negotiable and should guide every aspect of the question generation.`
    : "";

  // Format existing questions to avoid duplicates
  const existingQuestionsSection =
    existingQuestions.length > 0
      ? `\nEXISTING QUESTIONS (avoid generating similar questions):\n${existingQuestions
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n")}\n\nGenerate a completely different and unique question.`
      : "";

  const formatSection = forceCoding
    ? 'IMPORTANT: You MUST choose the "Coding" question format for this question. The candidate must write or debug code to answer this question.\n\n2. "Coding" - Candidate writes or debugs code. Used for evaluating problem-solving skills, algorithms, and programming language proficiency.'
    : `Randomly choose one of these question formats and design the question accordingly:
1. "Open-ended" - Requires a descriptive or narrative answer. Useful for assessing communication, reasoning, or opinion-based responses.
2. "Coding" - Candidate writes or debugs code. Used for evaluating problem-solving skills, algorithms, and programming language proficiency.
3. "Scenario" - Presents a short, realistic situation and asks how the candidate would respond or act. Tests decision-making, ethics, soft skills, or role-specific judgment.
4. "Case Study" - In-depth problem based on a real or simulated business/technical challenge. Requires analysis, synthesis of information, and a structured response. Often multi-step.
5. "Design" - Asks the candidate to architect a system, process, or solution. Often used in software/system design, business process optimization, or operational planning.
6. "Live Assessment" - Real-time tasks like pair programming, whiteboarding, or collaborative exercises. Tests real-world working ability and communication under pressure.`;

  return `Generate exactly 1 unique interview question for the skill "${skillName}" at a ${level} level (${effectiveDifficulty} difficulty).
The question should be challenging but fair, testing both theoretical knowledge and practical application.${feedbackSection}${existingQuestionsSection}

Expectations based on experience level:
- BEGINNER: Focus on foundational concepts, simple application, definitions, and basic logic.
- INTERMEDIATE: Mix of conceptual and applied questions, moderate coding tasks, and situational judgment.
- PROFESSIONAL: Emphasize real-world problem solving, architecture/design, optimization, decision-making, and advanced coding or domain-specific knowledge.

${formatSection}

Format your response as a JSON object with a 'question' key containing a single question object, where the object has:
1. A "question" field with the interview question (must not exceed 400 characters)
2. A "answer" field with a suggested model answer for the interviewer (should be comprehensive)
3. A "category" field with one of: "Technical", "Experience", "Problem Solving", or "Soft Skills"
4. A "difficulty" field with "${effectiveDifficulty}"
5. A "skillName" field with "${skillName}"
6. A "questionFormat" field with one of: "Open-ended", "Coding", "Scenario", "Case Study", "Design", or "Live Assessment"
7. A "coding" field with a boolean value: true if the questionFormat is "Coding" OR if the question involves writing, debugs, or analyzing code, false otherwise

Example Response:
{
  "question": {
    "question": "You're working on a Java service that suddenly starts throwing 'OutOfMemoryError'. How would you debug and resolve the issue?",
    "answer": "Check JVM heap size configuration, analyze heap dumps using tools like VisualVM or Eclipse MAT. Look for memory leaks, large object retention, or improper caching. Use profiling tools to monitor object creation and garbage collection behavior.",
    "category": "Experience",
    "difficulty": "Medium",
    "skillName": "Java",
    "questionFormat": "Scenario",
    "coding": false
  }
}

IMPORTANT: The "coding" field must be set to true when questionFormat is "Coding" or when the question requires the candidate to write, debug, or analyze code. This includes code reviews, algorithm problems, debugging exercises, or any hands-on programming tasks.

Make sure the question matches the specified difficulty level, is appropriate for the skill, follows the chosen question format, and is completely unique from any existing questions.`;
};

// Generate a single question for a skill
const generateSingleQuestion = async (
  skill: any,
  recordId: string,
  feedback: string,
  existingQuestions: string[] = [],
  forceCoding: boolean = false
) => {
  try {
    const prompt = generateSingleQuestionPrompt(
      skill.name,
      skill.level,
      skill.difficulty || "Medium",
      feedback,
      existingQuestions,
      forceCoding
    );

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are an expert interviewer who creates relevant interview questions for specific technical skills. Generate exactly 1 unique question that must not exceed 400 characters. Include a detailed suggested answer. ${
            feedback
              ? "CRITICAL: You MUST incorporate the provided feedback into your question generation. This feedback is non-negotiable."
              : ""
          }${
            forceCoding
              ? " IMPORTANT: This question MUST be a coding question requiring the candidate to write or debug code."
              : ""
          }`,
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
      throw new Error("No response received from OpenAI");
    }

    const parsedResponse = JSON.parse(content);

    if (!parsedResponse.question) {
      throw new Error("Invalid response format from OpenAI");
    }

    return parsedResponse.question;
  } catch (error) {
    console.error(
      `Error generating single question for skill ${skill.name}:`,
      error
    );
    throw error;
  }
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordId } = await params;
    const body = await request.json();
    const { skillId, feedback } = body;

    if (!recordId || !skillId) {
      return NextResponse.json(
        { error: "Record ID and Skill ID are required" },
        { status: 400 }
      );
    }

    // Get the skill
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    // Get all questions for this skill (excluding deleted ones)
    const questions = await prisma.question.findMany({
      where: {
        skillId: skillId,
        recordId: recordId,
        deleted: {
          not: true,
        },
      },
      select: {
        id: true,
        content: true,
        coding: true,
      },
    });

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No questions found for this skill" },
        { status: 404 }
      );
    }

    // Check if existing questions for this skill are coding questions
    let requiresCoding = false;
    const existingQuestionTexts: string[] = [];

    for (const question of questions) {
      try {
        const parsedContent = JSON.parse(question.content);
        const isCodingQuestion =
          question.coding === true ||
          parsedContent.coding === true ||
          parsedContent.questionFormat?.toLowerCase() === "coding";

        if (isCodingQuestion) {
          requiresCoding = true;
        }

        // Store question text to avoid duplicates
        if (parsedContent.question) {
          existingQuestionTexts.push(parsedContent.question);
        }
      } catch (error) {
        console.error("Error parsing question content:", error);
      }
    }

    const logger = getLogger("regenerate-questions-from-skill");
    logger.info(
      `Regenerating ${questions.length} questions for skill ${skill.name}`
    );

    // Store all regenerated questions
    const allRegeneratedQuestions: any[] = [];
    let totalQuestionsRegenerated = 0;

    // Use a transaction to mark old questions as deleted and create new ones
    const result = await prisma.$transaction(async (tx) => {
      // First, mark all existing questions as deleted
      for (const question of questions) {
        await tx.question.update({
          where: { id: question.id },
          data: {
            deleted: true,
            deletedFeedback: feedback || "Skill questions regeneration",
          },
        });
      }

      // Generate questions one by one
      for (let i = 0; i < questions.length; i++) {
        try {
          logger.info(
            `Generating question ${i + 1}/${questions.length} for skill ${
              skill.name
            }`
          );

          // Generate a single question
          const question = await generateSingleQuestion(
            skill,
            recordId,
            feedback || "",
            existingQuestionTexts, // Pass existing questions to avoid duplicates
            requiresCoding // Force coding questions if existing questions are coding
          );

          // Ensure coding flag is properly set
          const isCoding =
            question.coding === true ||
            question.questionFormat?.toLowerCase() === "coding" ||
            (question.question &&
              question.question.toLowerCase().includes("code")) ||
            (question.question &&
              question.question.toLowerCase().includes("algorithm")) ||
            (question.question &&
              question.question.toLowerCase().includes("programming"));

          // Create the new question
          const newQuestionRecord = await tx.question.create({
            data: {
              content: JSON.stringify({
                question: question.question,
                answer: question.answer,
                category: question.category,
                difficulty: question.difficulty,
                questionFormat:
                  question.questionFormat || skill.questionFormat || "Scenario",
                coding: isCoding,
                floCareerId: null, // Reset floCareerId for new question
              }),
              skillId: skillId,
              recordId: recordId,
              liked: "NONE",
              coding: isCoding,
              floCareerId: null, // Reset floCareerId for new question
            },
          });

          // Create a regeneration record
          await tx.regeneration.create({
            data: {
              originalQuestionId: questions[i].id,
              newQuestionId: newQuestionRecord.id,
              reason: "Skill questions regeneration",
              userFeedback: feedback,
              skillId: skillId,
              recordId: recordId,
            },
          });

          // Add the new question text to existing texts to avoid duplicates in future generations
          existingQuestionTexts.push(question.question);

          allRegeneratedQuestions.push(newQuestionRecord);
          totalQuestionsRegenerated++;

          // Add a small delay between API calls to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error(
            `Error generating question ${i + 1} for skill ${skill.name}:`,
            error
          );
          // Continue with the next question
        }
      }

      return allRegeneratedQuestions;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully regenerated ${totalQuestionsRegenerated} questions for skill ${skill.name}`,
      questions: result,
    });
  } catch (error: any) {
    console.error("Error regenerating questions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to regenerate questions",
      },
      { status: 500 }
    );
  }
}
