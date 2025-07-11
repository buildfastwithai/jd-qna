import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { getLogger } from "@/lib/logger";
// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params;

    // Add error handling for body parsing
    let reason: string | null = null;
    let userFeedback: string | null = null;

    try {
      const body = await request.json();
      reason = body.reason || null;
      userFeedback = body.userFeedback || null;
    } catch (error) {
      // If body parsing fails, continue with empty values
      console.warn("No request body provided or invalid JSON");
    }

    if (!questionId) {
      return NextResponse.json(
        { error: "Question ID is required" },
        { status: 400 }
      );
    }

    // Get the question with its skill and feedback
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        skill: true,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Parse the question content
    const questionContent = JSON.parse(question.content);

    // Prepare the prompt for OpenAI
    let prompt = `Generate a new interview question for the skill "${question.skill.name}" at ${question.skill.level} level.`;

    // Add the old question for context
    prompt += `\nOriginal question: ${questionContent.question}`;

    // Add reason for regeneration if provided
    if (reason) {
      prompt += `\n\nReason for regeneration: "${reason}"`;
      prompt += `\nPlease address this specific concern in the new question.`;
    }

    // Add feedback if available - emphasize this importance
    if (question.feedback) {
      prompt += `\n\nUser feedback on original question: "${question.feedback}"`;
      prompt += `\n\nPlease use this feedback to greatly improve the question. The feedback is very important and should guide your response.`;
    } else {
      prompt += `\nPlease generate a different question for this skill.`;
    }

    // Include difficulty if available
    if (question.skill.difficulty) {
      prompt += `\nDifficulty level: ${question.skill.difficulty}`;
    }

    // Add question format instructions
    prompt += `\n\nFor the question format, randomly choose one of these and design the question accordingly:
1. "Open-ended" - Requires a descriptive or narrative answer. Useful for assessing communication, reasoning, or opinion-based responses.
2. "Coding" - Candidate writes or debugs code. Used for evaluating problem-solving skills, algorithms, and programming language proficiency.
3. "Scenario" - Presents a short, realistic situation and asks how the candidate would respond or act. Tests decision-making, ethics, soft skills, or role-specific judgment.
4. "Case Study" - In-depth problem based on a real or simulated business/technical challenge. Requires analysis, synthesis of information, and a structured response. Often multi-step.
5. "Design" - Asks the candidate to architect a system, process, or solution. Often used in software/system design, business process optimization, or operational planning.
6. "Live Assessment" - Real-time tasks like pair programming, whiteboarding, or collaborative exercises. Tests real-world working ability and communication under pressure.

IMPORTANT: For each skill, generate either all coding questions or all non-coding questions, not a mix.

A "questionFormat" field that must be the same for all questions generated for a given skill: either "Coding" (for coding questions) or one of: "Open-ended", "Scenario", "Case Study", "Design", or "Live Assessment" (for non-coding questions).

IMPORTANT: The "coding" field must be set to true when questionFormat is "Coding"

Example:
{
  "question": "Can you describe your experience with deploying applications using Docker containers?",
  "answer": "A strong answer would demonstrate hands-on experience with Docker, including creating Dockerfiles, managing containers, using Docker Compose for multi-container applications, and understanding Docker networking and volumes. The candidate should explain specific projects where they've used Docker in production environments, challenges they faced, and how they solved them. Knowledge of Docker orchestration with Kubernetes or Docker Swarm would be a plus.",
  "category": "Technical",
  "difficulty": "Medium",
  "skillName": "Docker",
  "questionFormat": "Open-ended",
  "coding": false
}`;

    const logger = getLogger("regenerate-dislike");
    logger.info(prompt);
    console.log(prompt);

    // Generate a new question using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are an expert interviewer creating high-quality interview questions. Format your response as a JSON object with fields: question, answer, category (Technical/Experience/Problem Solving/Soft Skills), difficulty (Easy/Medium/Hard), questionFormat (Open-ended/Coding/Scenario/Case Study/Design/Live Assessment), and coding (boolean: true if questionFormat is 'Coding' or question involves writing/debugging code, false otherwise).",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    // Parse the response
    const content = response.choices[0].message.content;
    if (content) {
      logger.info(content);
      console.log(content);
    }
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    try {
      const parsedResponse = JSON.parse(content);
      let newQuestion;

      // Check different possible formats of the response
      if (parsedResponse.question) {
        newQuestion = parsedResponse;
      } else if (
        parsedResponse.questions &&
        Array.isArray(parsedResponse.questions) &&
        parsedResponse.questions.length > 0
      ) {
        newQuestion = parsedResponse.questions[0];
      } else {
        throw new Error("Invalid response format from OpenAI");
      }

      // Update the question in the database
      await prisma.question.update({
        where: { id: questionId },
        data: {
          content: JSON.stringify({
            question: newQuestion.question,
            answer: newQuestion.answer,
            category: newQuestion.category,
            difficulty: newQuestion.difficulty,
            questionFormat: newQuestion.questionFormat || "Scenario",
            coding: newQuestion.coding || false,
          }),
          liked: "NONE",
          feedback: null, // Clear feedback after regeneration
        },
      });

      // Create a regeneration record
      await prisma.regeneration.create({
        data: {
          originalQuestionId: questionId,
          newQuestionId: questionId, // Same as original since we're updating in place
          reason: reason || "Disliked question",
          userFeedback: userFeedback,
          skillId: question.skill.id,
          recordId: question.recordId,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Successfully regenerated question",
        question: {
          id: questionId,
          content: {
            question: newQuestion.question,
            answer: newQuestion.answer,
            category: newQuestion.category,
            difficulty: newQuestion.difficulty,
            questionFormat: newQuestion.questionFormat || "Scenario",
            coding: newQuestion.coding || false,
          },
        },
      });
    } catch (e) {
      console.error(`Error processing regenerated question:`, e);
      throw e; // Re-throw to be caught by outer try-catch
    }
  } catch (error: any) {
    console.error("Error regenerating question:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to regenerate question",
      },
      { status: 500 }
    );
  }
}
