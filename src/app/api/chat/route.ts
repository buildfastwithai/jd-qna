import { NextResponse } from "next/server";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { message, jobDescription, skills, chatHistory } = await request.json();

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    // Build the conversation history for the AI
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a Job Description Assistant that helps users understand job requirements and prepare for interviews.
        
        ${jobDescription ? "You have access to the following job description:" : "No job description has been uploaded yet."}
        ${jobDescription ? `\n\n${jobDescription}\n\n` : ""}
        
        ${skills && skills.length > 0 ? "The job requires the following skills:" : ""}
        ${
          skills && skills.length > 0
            ? skills
                .map(
                  (skill: any) =>
                    `- ${skill.name} (Level: ${skill.level}, Requirement: ${skill.requirement})`
                )
                .join("\n")
            : ""
        }
        
        Your task is to provide helpful answers about the job description, required skills, and interview preparation advice.
        Be concise, direct, and focus on providing valuable information to the user.`,
      },
    ];

    // Add previous conversation history
    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach((msg: any) => {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      });
    }

    // Add the current message
    messages.push({
      role: "user",
      content: message,
    });

    // Call OpenAI API
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response received from OpenAI");
    }

    return NextResponse.json({
      success: true,
      message: responseContent,
    });
  } catch (error: any) {
    console.error("Error in chat:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process chat message",
      },
      { status: 500 }
    );
  }
} 