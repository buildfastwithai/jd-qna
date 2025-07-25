import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordId } = await params;

    // Get the skill record with skills and questions
    const record = await prisma.skillRecord.findUnique({
      where: { id: recordId },
      include: {
        skills: {
          include: {
            questions: {
              where: {
                floCareerId: {
                  not: null,
                },
              },
            },
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

    if (!record.reqId || !record.userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing reqId or userId for FloCareer integration",
        },
        { status: 400 }
      );
    }

    // Group questions by skills and create question pools
    const questionPools = [];

    for (const skill of record.skills) {
      // Only include skills that have questions with floCareerId
      const questionsWithFloId = skill.questions.filter((q) => q.floCareerId);

      if (questionsWithFloId.length > 0) {
        const pool = {
          pool_id: 0,
          action: "add",
          name: skill.name,
          num_of_questions_to_ask: questionsWithFloId.length,
          questions: questionsWithFloId.map((q) => q.floCareerId),
        };
        questionPools.push(pool);
      }
    }

    if (questionPools.length === 0) {
      return NextResponse.json(
        { success: false, error: "No questions with FloCareer IDs found" },
        { status: 400 }
      );
    }

    // Prepare request body for FloCareer API
    const requestBody = {
      user_id: record.userId,
      req_id: record.reqId,
      question_pools: questionPools,
    };

    console.log("Creating interview structure with:", requestBody);

    // Call FloCareer API
    const response = await fetch(
      "https://sandbox.flocareer.com/dynamic/corporate/create-interview-structure/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`FloCareer API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Interview structure created successfully in FloCareer",
        data: result,
        questionPools: questionPools,
      });
    } else {
      throw new Error(
        result.error_string || "Failed to create interview structure"
      );
    }
  } catch (error: any) {
    console.error("Error creating interview structure:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create interview structure",
      },
      { status: 500 }
    );
  }
}
