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
      return NextResponse.json(
        { error: "Skill not found" },
        { status: 404 }
      );
    }

    // Get all questions for this skill
    const questions = await prisma.question.findMany({
      where: { 
        skillId: skillId,
        recordId: recordId
      },
    });

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No questions found for this skill" },
        { status: 404 }
      );
    }

    const logger = getLogger("regenerate-questions-from-skill");
    logger.info(`Regenerating ${questions.length} questions for skill ${skill.name}`);

    // Prepare the regeneration prompt
    let prompt = `Generate ${questions.length} new interview questions for the skill "${skill.name}" at ${skill.level} level.`;
    
    // Add feedback if provided
    if (feedback) {
      prompt += `\n\nUser feedback: "${feedback}"`;
      prompt += `\nPlease use this feedback to improve all questions. The feedback is very important and should guide your response.`;
    }

    // Include difficulty if available
    if (skill.difficulty) {
      prompt += `\nDifficulty level: ${skill.difficulty}`;
    }

    // Add question format instructions
    prompt += `\n\nFor the question format, use "${skill.questionFormat || 'Scenario'}" and design all questions accordingly.
    
If the format is "Coding", all questions should involve writing or debugging code. Otherwise, design non-coding questions that match the specified format.

IMPORTANT: The "coding" field must be set to true when questionFormat is "Coding", and false otherwise.

Return exactly ${questions.length} questions as a JSON array. Each question should have these fields:
- question: The interview question text
- answer: A comprehensive model answer or evaluation criteria
- category: One of "Technical", "Experience", "Problem Solving", or "Soft Skills"
- difficulty: "Easy", "Medium", or "Hard"
- questionFormat: "${skill.questionFormat || 'Scenario'}"
- coding: ${skill.questionFormat === "Coding" ? "true" : "false"}`;

    logger.info(prompt);

    // Generate new questions using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are an expert interviewer creating high-quality interview questions. Format your response as a JSON array of question objects, each with fields: question, answer, category (Technical/Experience/Problem Solving/Soft Skills), difficulty (Easy/Medium/Hard), questionFormat, and coding (boolean).",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    // Parse the response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    logger.info(content);

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
      } else {
        // If it's a single question, wrap it in an array
        newQuestions = [parsedResponse];
      }

      // Make sure we have the right number of questions
      newQuestions = newQuestions.slice(0, questions.length);

      // Update each question in the database
      const updatedQuestions = [];
      for (let i = 0; i < Math.min(questions.length, newQuestions.length); i++) {
        const originalQuestion = questions[i];
        const newQuestion = newQuestions[i];

        const updatedQuestion = await prisma.question.update({
          where: { id: originalQuestion.id },
          data: {
            content: JSON.stringify({
              question: newQuestion.question,
              answer: newQuestion.answer,
              category: newQuestion.category,
              difficulty: newQuestion.difficulty,
              questionFormat: newQuestion.questionFormat || skill.questionFormat || "Scenario",
              coding: newQuestion.coding || skill.questionFormat === "Coding",
              floCareerId: originalQuestion.floCareerId || null,
            }),
            liked: "NONE",
            feedback: null, // Clear feedback after regeneration
          },
        });

        // Create or update a regeneration record
        await prisma.regeneration.upsert({
          where: {
            originalQuestionId_newQuestionId: {
              originalQuestionId: originalQuestion.id,
              newQuestionId: originalQuestion.id,
            }
          },
          update: {
            reason: "Skill questions regeneration",
            userFeedback: feedback,
            updatedAt: new Date(),
          },
          create: {
            originalQuestionId: originalQuestion.id,
            newQuestionId: originalQuestion.id, // Same as original since we're updating in place
            reason: "Skill questions regeneration",
            userFeedback: feedback,
            skillId: skillId,
            recordId: recordId,
          },
        });

        updatedQuestions.push(updatedQuestion);
      }

      return NextResponse.json({
        success: true,
        message: `Successfully regenerated ${updatedQuestions.length} questions for skill ${skill.name}`,
        questions: updatedQuestions,
      });
    } catch (e) {
      console.error(`Error processing regenerated questions:`, e);
      throw e; // Re-throw to be caught by outer try-catch
    }
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
