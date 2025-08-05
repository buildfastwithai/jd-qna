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
      // Get all questions with floCareerId for this skill
      const questionsWithFloId = skill.questions.filter((q) => q.floCareerId);

      if (questionsWithFloId.length > 0) {
        // Separate active and deleted questions
        const activeQuestions = questionsWithFloId.filter((q) => !q.deleted);
        const deletedQuestions = questionsWithFloId.filter((q) => q.deleted);

        // Handle active questions
        if (activeQuestions.length > 0) {
          const pool = {
            pool_id: 0,
            action: "add",
            name: skill.name,
            num_of_questions_to_ask: activeQuestions.length,
            questions: activeQuestions.map((q) => q.floCareerId),
          };
          questionPools.push(pool);
        }

        // Handle deleted questions
        if (deletedQuestions.length > 0) {
          const deletedQuestionIds = deletedQuestions
            .map((q) => q.floCareerId)
            .filter(Boolean); // Only include questions that have a floCareerId

          if (deletedQuestionIds.length > 0) {
            // Group deleted questions by their floCareerPoolId
            const questionsByPool = new Map<number, number[]>();

            for (const question of deletedQuestions) {
              if (question.floCareerId && question.floCareerPoolId) {
                const poolId = question.floCareerPoolId;
                if (!questionsByPool.has(poolId)) {
                  questionsByPool.set(poolId, []);
                }
                questionsByPool.get(poolId)!.push(question.floCareerId);
              }
            }

            // Create separate delete pools for each unique pool_id
            for (const [poolId, questionIds] of questionsByPool) {
              const deletedPool = {
                pool_id: poolId, // Use floCareerPoolId for deletion
                action: "delete",
                name: skill.name,
                num_of_questions_to_ask: questionIds.length,
                questions: questionIds,
              };
              questionPools.push(deletedPool);
            }
          }
        }
      }
    }

    if (questionPools.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No questions or deleted questions with FloCareer IDs found",
        },
        { status: 400 }
      );
    }

    // Prepare request body for FloCareer API
    const requestBody = {
      user_id: record.userId,
      round_id: record.reqId,
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
      // Process the response to store floCareerPoolId for each question
      if (result.question_pools && Array.isArray(result.question_pools)) {
        for (const pool of result.question_pools) {
          if (pool.questions && Array.isArray(pool.questions)) {
            for (const questionData of pool.questions) {
              if (questionData.ai_question_id && questionData.question_id) {
                // Find the question by floCareerId
                const question = await prisma.question.findFirst({
                  where: {
                    floCareerId: questionData.question_id,
                    recordId: recordId,
                  },
                });

                if (question) {
                  // Update the question with the pool_id as floCareerPoolId
                  await prisma.question.update({
                    where: { id: question.id },
                    data: {
                      floCareerPoolId: pool.pool_id,
                      floCareerId: questionData.question_id,
                    },
                  });
                }
              }
            }
          }
        }
      }

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
