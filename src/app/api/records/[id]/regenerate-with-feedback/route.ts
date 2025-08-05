import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { getLogger } from "@/lib/logger";
// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

      // Create a prompt that includes global feedback
      let globalFeedbackPrompt = "";
      if (globalFeedback) {
        globalFeedbackPrompt = `\n\nGLOBAL FEEDBACK FOR ALL QUESTIONS: ${globalFeedback}`;
      }

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

      // Create the prompt
      const prompt = `Generate improved interview questions for the skill "${
        skill.name
      }" at ${skill.level} level.
Difficulty: ${skillContext.difficulty}
Category: ${getCategoryLabel(skillContext.category)}

For each question, randomly choose one of these question formats and design the question accordingly:
1. "Open-ended" - Requires a descriptive or narrative answer. Useful for assessing communication, reasoning, or opinion-based responses.
2. "Coding" - Candidate writes or debugs code. Used for evaluating problem-solving skills, algorithms, and programming language proficiency.
3. "Scenario" - Presents a short, realistic situation and asks how the candidate would respond or act. Tests decision-making, ethics, soft skills, or role-specific judgment.
4. "Case Study" - In-depth problem based on a real or simulated business/technical challenge. Requires analysis, synthesis of information, and a structured response. Often multi-step.
5. "Design" - Asks the candidate to architect a system, process, or solution. Often used in software/system design, business process optimization, or operational planning.
6. "Live Assessment" - Real-time tasks like pair programming, whiteboarding, or collaborative exercises. Tests real-world working ability and communication under pressure.

${globalFeedbackPrompt}

CURRENT QUESTIONS WITH FEEDBACK:
${questionsWithFeedback
  .map(
    (q: any, index: number) => `
Question ${index + 1}: ${q.question}
${q.feedback ? `Feedback: ${q.feedback}` : "No specific feedback"}`
  )
  .join("\n")}

Please generate exactly ${
        questionsWithFeedback.length
      } new and improved questions based on the feedback provided. 
Format your response as a JSON array where each object has: question, answer, category, difficulty, and questionFormat fields.
Category should be one of: Technical, Experience, Problem Solving, Soft Skills, Functional, Behavioral, Cognitive.
Difficulty should be one of: Easy, Medium, Hard.
A "questionFormat" field that must be the same for all questions generated for a given skill: either "Coding" (for coding questions) or one of: "Open-ended", "Scenario", "Case Study", "Design", or "Live Assessment" (for non-coding questions).

IMPORTANT: For each skill, generate either all coding questions or all non-coding questions, not a mix.

IMPORTANT: The "coding" field must be set to true when questionFormat is "Coding".

VERY IMPORTANT:
If there is change in the questionFormat, then the "coding" field must be set to true if the questionFormat is "Coding" , false otherwise.

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
]}
`;
      const logger = getLogger("regenerate-with-feedback");
      logger.info(prompt);
      console.log(prompt);
      // Call OpenAI
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `You are an expert interviewer who creates high-quality interview questions. 
Your task is to generate improved questions based on specific feedback.
You must output the content in a valid JSON format.
You must generate exactly the requested number of questions.`,
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
        console.error(`No content returned for skill ${skill.name}`);
        continue;
      }
      logger.info(content);
      console.log(content);
      try {
        const parsedResponse = JSON.parse(content);
        let newQuestions = [];

        // Check different possible formats of the response
        if (Array.isArray(parsedResponse)) {
          newQuestions = parsedResponse;
        } else if (
          parsedResponse.questions &&
          Array.isArray(parsedResponse.questions)
        ) {
          newQuestions = parsedResponse.questions;
        }

        // Ensure we have the right number of questions
        if (newQuestions.length !== questionsWithFeedback.length) {
          console.warn(
            `Expected ${questionsWithFeedback.length} questions but got ${newQuestions.length}`
          );
        }

        // Use a transaction to mark old questions as deleted and create new ones
        await prisma.$transaction(async (tx) => {
          // First, mark all existing questions as deleted
          for (const oldQuestion of questionsWithFeedback) {
            await tx.question.update({
              where: { id: oldQuestion!.id },
              data: {
                deleted: true,
                deletedFeedback:
                  feedbackMap.get(oldQuestion!.id) ||
                  "Regenerated with feedback",
              },
            });
          }

          // Then create new questions
          for (
            let i = 0;
            i < Math.min(newQuestions.length, questionsWithFeedback.length);
            i++
          ) {
            const newQuestion = newQuestions[i];
            const oldQuestion = questionsWithFeedback[i];

            // Create the new question
            const newQuestionRecord = await tx.question.create({
              data: {
                content: JSON.stringify({
                  question: newQuestion.question,
                  answer: newQuestion.answer,
                  category: newQuestion.category,
                  difficulty: newQuestion.difficulty,
                  questionFormat: newQuestion.questionFormat || "Scenario",
                  coding: newQuestion.coding || false,
                  floCareerId: null, // Reset floCareerId for new question
                }),
                skillId: skill.id,
                recordId: record.id,
                liked: "NONE",
                coding: newQuestion.coding || false,
                floCareerId: null, // Reset floCareerId for new question
              },
            });

            // Create a regeneration record
            await tx.regeneration.create({
              data: {
                originalQuestionId: oldQuestion!.id,
                newQuestionId: newQuestionRecord.id,
                reason: "Regenerated with feedback",
                userFeedback: feedbackMap.get(oldQuestion!.id) || null,
                skillId: skill.id,
                recordId: record.id,
              },
            });

            totalRegeneratedQuestions++;
          }
        });
      } catch (e) {
        console.error(
          `Error processing regenerated questions for skill ${skill.name}:`,
          e
        );
      }
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
