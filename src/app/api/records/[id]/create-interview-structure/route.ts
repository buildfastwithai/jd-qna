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

    if (!record.roundId || !record.userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing roundId or userId for FloCareer integration",
        },
        { status: 400 }
      );
    }

    // Group questions by skills and create question pools
    const questionPools = [];

    for (const skill of record.skills) {
      // Get all questions with floCareerId for this skill
      const questionsWithFloId = skill.questions.filter((q) => q.floCareerId);

      // Handle deleted skills
      if (skill.deleted) {
        // Get unique pool IDs from questions of this skill
        const poolIds = new Set<number>();
        for (const question of questionsWithFloId) {
          if (question.floCareerPoolId) {
            poolIds.add(question.floCareerPoolId);
          }
        }

        // Create delete action for each pool
        for (const poolId of poolIds) {
          const deletedSkillPool = {
            pool_id: poolId,
            action: "delete",
            name: skill.name,
            num_of_questions_to_ask: 0,
            questions: [],
          };
          questionPools.push(deletedSkillPool);
        }
        continue; // Skip processing questions for deleted skills
      }

      // Handle active skills
      if (questionsWithFloId.length > 0) {
        // Separate active and deleted questions
        const activeQuestions = questionsWithFloId.filter((q) => !q.deleted);
        const deletedQuestions = questionsWithFloId.filter((q) => q.deleted);

        // Handle active questions
        if (activeQuestions.length > 0) {
          // Group active questions by their floCareerPoolId
          const questionsByPool = new Map<number, number[]>();

          for (const question of activeQuestions) {
            if (question.floCareerId) {
              const poolId = question.floCareerPoolId || 0;
              if (!questionsByPool.has(poolId)) {
                questionsByPool.set(poolId, []);
              }
              questionsByPool.get(poolId)!.push(question.floCareerId);
            }
          }

          // Create pools for active questions
          for (const [poolId, questionIds] of questionsByPool) {
            const action = poolId === 0 ? "add" : "edit";
            const pool = {
              pool_id: poolId,
              action: action,
              name: skill.name,
              num_of_questions_to_ask: questionIds.length,
              questions: questionIds,
            };
            questionPools.push(pool);
          }
        }

        // Handle deleted questions (exclude from questions array, action: edit if floCareerPoolId exists)
        if (deletedQuestions.length > 0) {
          // Group deleted questions by their floCareerPoolId
          const deletedQuestionsByPool = new Map<number, number[]>();

          for (const question of deletedQuestions) {
            if (question.floCareerId && question.floCareerPoolId) {
              const poolId = question.floCareerPoolId;
              if (!deletedQuestionsByPool.has(poolId)) {
                deletedQuestionsByPool.set(poolId, []);
              }
              deletedQuestionsByPool.get(poolId)!.push(question.floCareerId);
            }
          }

          // Create edit pools for deleted questions (excluding them from questions array)
          for (const [poolId, questionIds] of deletedQuestionsByPool) {
            // Get remaining active questions for this pool
            const remainingActiveQuestions = activeQuestions
              .filter((q) => q.floCareerPoolId === poolId && q.floCareerId)
              .map((q) => q.floCareerId!);

            const editPool = {
              pool_id: poolId,
              action: "edit",
              name: skill.name,
              num_of_questions_to_ask: remainingActiveQuestions.length,
              questions: remainingActiveQuestions, // Only include active questions
            };
            questionPools.push(editPool);
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
      round_id: record.roundId,
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
      console.log("FloCareer API error:", response);
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
