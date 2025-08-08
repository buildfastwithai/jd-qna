import { NextRequest, NextResponse } from "next/server";
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
  originalQuestion: string,
  feedback: string,
  globalFeedback: string,
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

  // Format feedback sections - make them very strict
  const feedbackSection = feedback
    ? `\n\nCRITICAL QUESTION-SPECIFIC FEEDBACK - YOU MUST FOLLOW THIS STRICTLY:\n"${feedback}"\n\nIMPORTANT: The new question MUST address and incorporate this specific feedback. This feedback is non-negotiable and should guide every aspect of the question generation.`
    : "";

  const globalFeedbackSection = globalFeedback
    ? `\n\nCRITICAL GLOBAL FEEDBACK - YOU MUST FOLLOW THIS STRICTLY:\n"${globalFeedback}"\n\nIMPORTANT: The new question MUST also address and incorporate this global feedback. This feedback applies to all questions and is non-negotiable.`
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

  return `Generate exactly 1 improved interview question for the skill "${skillName}" at a ${level} level (${effectiveDifficulty} difficulty).
The question should be challenging but fair, testing both theoretical knowledge and practical application.

ORIGINAL QUESTION TO IMPROVE:
"${originalQuestion}"${feedbackSection}${globalFeedbackSection}${existingQuestionsSection}

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
  originalQuestion: string,
  feedback: string,
  globalFeedback: string,
  existingQuestions: string[] = [],
  forceCoding: boolean = false
) => {
  try {
    const prompt = generateSingleQuestionPrompt(
      skill.name,
      skill.level,
      skill.difficulty || "Medium",
      originalQuestion,
      feedback,
      globalFeedback,
      existingQuestions,
      forceCoding
    );

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are an expert interviewer who creates relevant interview questions for specific technical skills. Generate exactly 1 unique question that must not exceed 400 characters. Include a detailed suggested answer. CRITICAL: You MUST incorporate the provided feedback into your question generation. This feedback is non-negotiable.${
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { feedback, globalFeedback } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Record ID is required" },
        { status: 400 }
      );
    }

    // Check if record exists and belongs to the user
    const record = await prisma.skillRecord.findUnique({
      where: {
        id,
      },
      include: {
        skills: {
          where: {
            OR: [
              { requirement: "MANDATORY" },
              { requirement: "OPTIONAL", numQuestions: { gt: 0 } },
            ],
          },
        },
        questions: {
          include: {
            skill: true,
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    // Create a map of question IDs to feedback
    const feedbackMap = new Map<string, string>();
    if (feedback && Array.isArray(feedback)) {
      feedback.forEach((item) => {
        if (item.questionId && item.feedback) {
          feedbackMap.set(item.questionId, item.feedback);
        }
      });
    }

    // Track how many questions we regenerate
    let totalRegeneratedQuestions = 0;

    // For each skill, regenerate questions with feedback
    for (const skill of record.skills) {
      // Get existing questions for this skill
      const skillQuestions = record.questions.filter(
        (q) => q.skillId === skill.id
      );

      // If no questions exist for this skill, skip
      if (skillQuestions.length === 0) {
        continue;
      }

      // Prepare the skill context
      const skillContext = {
        name: skill.name,
        level: skill.level,
        requirement: skill.requirement,
        difficulty: skill.difficulty || "Medium",
        questionFormat: skill.questionFormat || "Scenario based",
        category: skill.category || "TECHNICAL",
      };

      // Prepare questions with their feedback
      const questionsWithFeedback = skillQuestions
        .map((q) => {
          try {
            const content = JSON.parse(q.content);
            return {
              id: q.id,
              question: content.question,
              answer: content.answer,
              category: content.category,
              difficulty: content.difficulty,
              feedback: feedbackMap.get(q.id) || q.feedback || "",
              floCareerId: content.floCareerId || null,
            };
          } catch (e) {
            console.error("Error parsing question content:", e);
            return null;
          }
        })
        .filter(Boolean);

      // If no valid questions, skip
      if (questionsWithFeedback.length === 0) {
        continue;
      }

      // Check if existing questions for this skill are coding questions
      let requiresCoding = false;
      const existingQuestionTexts: string[] = [];

      for (const question of skillQuestions) {
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

      const logger = getLogger("regenerate-with-feedback");
      logger.info(
        `Regenerating ${questionsWithFeedback.length} questions for skill ${skill.name}`
      );

      // Use a transaction to mark old questions as deleted and create new ones
      await prisma.$transaction(async (tx) => {
        // First, mark all existing questions as deleted
        for (const oldQuestion of questionsWithFeedback) {
          await tx.question.update({
            where: { id: oldQuestion!.id },
            data: {
              deleted: true,
              deletedFeedback:
                feedbackMap.get(oldQuestion!.id) || "Regenerated with feedback",
            },
          });
        }

        // Generate questions one by one
        for (let i = 0; i < questionsWithFeedback.length; i++) {
          try {
            logger.info(
              `Generating question ${i + 1}/${
                questionsWithFeedback.length
              } for skill ${skill.name}`
            );

            const oldQuestion = questionsWithFeedback[i]!;
            const questionFeedback = feedbackMap.get(oldQuestion.id) || "";

            // Generate a single question
            const question = await generateSingleQuestion(
              skill,
              record.id,
              oldQuestion.question,
              questionFeedback,
              globalFeedback || "",
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
                  questionFormat: question.questionFormat || "Scenario",
                  coding: isCoding,
                  floCareerId: null, // Reset floCareerId for new question
                }),
                skillId: skill.id,
                recordId: record.id,
                liked: "NONE",
                coding: isCoding,
                floCareerId: null, // Reset floCareerId for new question
              },
            });

            // Create a regeneration record
            await tx.regeneration.create({
              data: {
                originalQuestionId: oldQuestion.id,
                newQuestionId: newQuestionRecord.id,
                reason: "Regenerated with feedback",
                userFeedback: feedbackMap.get(oldQuestion.id) || null,
                skillId: skill.id,
                recordId: record.id,
              },
            });

            // Add the new question text to existing texts to avoid duplicates in future generations
            existingQuestionTexts.push(question.question);

            totalRegeneratedQuestions++;

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
      });
    }

    return NextResponse.json({
      success: true,
      message: `Regenerated ${totalRegeneratedQuestions} questions based on feedback`,
    });
  } catch (error: any) {
    console.error("Error regenerating questions with feedback:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to regenerate questions",
      },
      { status: 500 }
    );
  }
}

// Helper function to format category
function getCategoryLabel(category: string = "TECHNICAL") {
  switch (category) {
    case "TECHNICAL":
      return "Technical";
    case "FUNCTIONAL":
      return "Functional";
    case "BEHAVIORAL":
      return "Behavioral";
    case "COGNITIVE":
      return "Cognitive";
    default:
      return "Technical";
  }
}
