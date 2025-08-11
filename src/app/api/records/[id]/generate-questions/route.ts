import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 1200000,
});

// Generate prompt for a single question
const generateSingleQuestionPrompt = (
  skillName: string,
  level: string,
  difficulty: string,
  existingQuestions: string[] = [],
  feedback: string[] = [],
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

  // Format feedback if available
  const feedbackSection =
    feedback.length > 0
      ? `\nIMPORTANT FEEDBACK TO CONSIDER:\n${feedback
          .map((fb, i) => `${i + 1}. ${fb}`)
          .join(
            "\n"
          )}\n\nPlease ensure that the generated question takes this feedback into account.`
      : "";

  // Format existing questions to avoid duplicates
  const existingQuestionsSection =
    existingQuestions.length > 0
      ? `\nEXISTING QUESTIONS (avoid generating similar questions):\n${existingQuestions
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n")}\n\nGenerate a completely different and unique question.`
      : "";

  const formatSection = forceCoding
    ? 'CRITICAL: You MUST choose ONLY the "Coding" question format for this question. The candidate must write or debug code to answer this question. Set coding field to true.\n\n2. "Coding" - Candidate writes or debugs code. The question MUST require hands-on programming, code writing, debugging, or algorithm implementation.'
    : `Choose one of these question formats and design the question accordingly:
    
1. "Open-ended" - Requires a descriptive or narrative answer. Useful for assessing communication, reasoning, or opinion-based responses. This type of question should not require coding. It comes under non-coding questions.

2. "Coding" - Candidate writes or debugs code. The question MUST require hands-on programming, code writing, debugging, or algorithm implementation. This type of question should require coding. It comes under coding questions.

3. "Scenario" - Presents a short, realistic situation and asks how the candidate would respond or act. Tests decision-making, ethics, soft skills, or role-specific judgment. This type of question should not require coding. It comes under non-coding questions.

4. "Case Study" - In-depth problem based on a real or simulated business/technical challenge. Requires analysis, synthesis of information, and a structured response. Often multi-step. This type of question should not require coding. It comes under non-coding questions.

5. "Design" - Asks the candidate to architect a system, process, or solution. Often used in software/system design, business process optimization, or operational planning. This type of question should not require coding. It comes under non-coding questions.

6. "Live Assessment" - Real-time tasks like pair programming, whiteboarding, or collaborative exercises. Tests real-world working ability and communication under pressure. This type of question should not require coding. It comes under non-coding questions.

CRITICAL CONSISTENCY RULE: If this is part of a batch of questions for the same skill, ALL questions must be either ALL coding questions (coding: true) OR ALL non-coding questions (coding: false). NO MIXING ALLOWED.`;

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

CRITICAL: The "coding" field must be set to true when questionFormat is "Coding" or when the question requires the candidate to write, or debug code. 

STRICT CONSISTENCY REQUIREMENT: ALL questions for the SAME skill must be EITHER all coding questions (coding: true) OR all non-coding questions (coding: false). NEVER mix coding and non-coding questions for the same skill.

IMPORTANT: FOR EACH SKILL, GENERATE EITHER ALL CODING QUESTIONS OR ALL NON-CODING QUESTIONS, NOT A MIX. ALWAYS DOUBLE CHECK THIS.

A Coding question means the candidate will write or debug code which will require code editor, so the "coding" field must be true.

A non-Coding question (Open-ended, Scenario, Case Study, Design, Live Assessment), means the candidate will explain the concept or process. NO CODING REQUIRED. So coding field must be false.

The "questionFormat" field must be consistent for all questions generated for a given skill: either "Coding" (for coding questions) or one of: "Open-ended", "Scenario", "Case Study", "Design", or "Live Assessment" (for non-coding questions).

${
  forceCoding
    ? 'FORCED CODING: This question MUST be a coding question with coding: true and questionFormat: "Coding".'
    : ""
}

Make sure the question matches the specified difficulty level, is appropriate for the skill, follows the chosen question format, and is completely unique from any existing questions.`;
};

// Generate a single question for a skill
const generateSingleQuestion = async (
  skill: any,
  recordId: string,
  existingQuestions: string[] = [],
  feedback: string[] = [],
  forceCoding: boolean = false,
  record: any
) => {
  try {
    const prompt = generateSingleQuestionPrompt(
      skill.name,
      skill.level,
      skill.difficulty || "Medium",
      existingQuestions,
      feedback,
      forceCoding
    );

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are an expert interviewer who creates relevant interview questions for specific technical skills. Generate exactly 1 unique question that must not exceed 400 characters. Include a detailed suggested answer. 
          ${
            record.minExperience
              ? `The candidate should have at least ${record.minExperience} years of experience.`
              : ""
          }
          ${
            record.maxExperience
              ? `The candidate should have at most ${record.maxExperience} years of experience.`
              : ""
          }
          ${
            feedback.length > 0
              ? "Incorporate the provided feedback into your question generation."
              : ""
          }${
            forceCoding
              ? " CRITICAL: This question MUST be a coding question requiring the candidate to write or debug code. Set coding: true and questionFormat: 'Coding'."
              : " CRITICAL: Maintain consistency - if generating multiple questions for the same skill, they must ALL be either coding or non-coding questions, never mixed."
          } STRICT RULE: For any given skill, ALL questions must be consistently either coding questions (coding: true) or non-coding questions (coding: false).`,
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
    const { id } = await params;

    // Accept force parameter and skillIds from request body
    const requestBody = await request.json();
    const forceRegenerate = requestBody.forceRegenerate === true;
    const specificSkillIds = requestBody.skillIds; // Array of skill IDs to generate questions for

    // Find the record with skills
    const record = await prisma.skillRecord.findUnique({
      where: { id },
      include: {
        skills: {
          where: specificSkillIds
            ? // If specific skill IDs are provided, filter by those
              { id: { in: specificSkillIds }, deleted: { not: true } }
            : // Otherwise, use the original logic
              {
                OR: [
                  { requirement: "MANDATORY" }, // Generate for mandatory skills
                  {
                    AND: [
                      { requirement: "OPTIONAL" },
                      { numQuestions: { gt: 0 } }, // Also generate for optional skills with question count > 0
                    ],
                  },
                ],
                deleted: { not: true },
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

    if (record.skills.length === 0) {
      const errorMessage = specificSkillIds
        ? "No skills found with the provided IDs"
        : "No mandatory skills found";
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      );
    }

    // Get feedback for all skills
    const allFeedback = await prisma.feedback.findMany({
      where: {
        skillId: {
          in: record.skills.map((skill: any) => skill.id),
        },
      },
      select: {
        content: true,
        skillId: true,
      },
    });

    // Create a map of skill IDs to feedback
    const feedbackMap = new Map<string, string[]>();
    allFeedback.forEach((feedback) => {
      const currentFeedback = feedbackMap.get(feedback.skillId) || [];
      currentFeedback.push(feedback.content);
      feedbackMap.set(feedback.skillId, currentFeedback);
    });

    // Get existing questions (excluding deleted ones)
    const existingQuestions = await prisma.question.findMany({
      where: {
        recordId: id,
        skillId: {
          in: record.skills.map((skill: any) => skill.id),
        },
        deleted: {
          not: true,
        },
      },
      select: {
        skillId: true,
        content: true,
        coding: true,
      },
    });

    // Count existing questions per skill and store question texts
    const existingQuestionCounts = new Map<string, number>();
    const existingQuestionTexts = new Map<string, string[]>();
    const skillCodingStatus = new Map<string, boolean>();

    existingQuestions.forEach((question) => {
      const currentCount = existingQuestionCounts.get(question.skillId) || 0;
      existingQuestionCounts.set(question.skillId, currentCount + 1);

      // Parse the content to get the question text and check coding status
      try {
        const parsedContent = JSON.parse(question.content);
        const questionText = parsedContent.question;
        const currentTexts = existingQuestionTexts.get(question.skillId) || [];
        currentTexts.push(questionText);
        existingQuestionTexts.set(question.skillId, currentTexts);

        // Check if this question is a coding question
        const isCodingQuestion =
          question.coding === true ||
          parsedContent.coding === true ||
          parsedContent.questionFormat?.toLowerCase() === "coding";

        // If any existing question is coding, mark the skill as requiring coding questions
        if (isCodingQuestion) {
          skillCodingStatus.set(question.skillId, true);
        }
      } catch (error) {
        console.error("Error parsing question content:", error);
      }
    });

    // Store all generated questions
    const allGeneratedQuestions = [];
    let totalQuestionsGenerated = 0;

    // Process each skill individually
    for (const skill of record.skills) {
      const requestedCount = skill.numQuestions || 1;
      const existingCount = existingQuestionCounts.get(skill.id) || 0;

      // If forceRegenerate is true, generate the full requested count
      // Otherwise, only generate what's needed to reach the requested count
      const neededCount = forceRegenerate
        ? requestedCount
        : Math.max(0, requestedCount - existingCount);

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

      // If forceRegenerate is true and we already have questions, mark the existing ones as deleted
      if (forceRegenerate && existingCount > 0) {
        console.log(
          `Marking ${existingCount} existing questions as deleted for skill ${skill.name}`
        );

        // Mark existing questions for this skill as deleted (soft delete)
        await prisma.question.updateMany({
          where: {
            skillId: skill.id,
            recordId: id,
            deleted: false, // Only update non-deleted questions
          },
          data: {
            deleted: true,
            deletedFeedback: "Force regenerated questions",
          },
        });

        // Reset the existing count and texts
        existingQuestionCounts.set(skill.id, 0);
        existingQuestionTexts.set(skill.id, []);
      }

      // Get feedback for this skill
      const skillFeedback = feedbackMap.get(skill.id) || [];

      // Get existing question texts for this skill (to avoid duplicates)
      const existingTexts = existingQuestionTexts.get(skill.id) || [];

      // Check if this skill requires coding questions
      const requiresCoding = skillCodingStatus.get(skill.id) || false;

      // Generate all questions for this skill with consistency validation
      const skillQuestions = [];
      let maxRetries = 10; // Prevent infinite loops
      let retryCount = 0;

      while (skillQuestions.length < neededCount && retryCount < maxRetries) {
        const questionsToGenerate = neededCount - skillQuestions.length;
        console.log(
          `Generating ${questionsToGenerate} questions for skill ${
            skill.name
          } (attempt ${retryCount + 1})`
        );

        // Generate questions for this batch
        const batchQuestions = [];
        for (let i = 0; i < questionsToGenerate; i++) {
          try {
            console.log(
              `Generating question ${i + 1}/${questionsToGenerate} for skill ${
                skill.name
              }`
            );

            // Generate a single question
            const question = await generateSingleQuestion(
              skill,
              id,
              existingTexts, // Pass existing questions to avoid duplicates
              skillFeedback,
              requiresCoding, // Force coding questions if existing questions are coding
              record
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

            batchQuestions.push({
              ...question,
              coding: isCoding,
            });

            // Add the new question text to existing texts to avoid duplicates
            existingTexts.push(question.question);

            // Add a small delay between API calls to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(
              `Error generating question ${i + 1} for skill ${skill.name}:`,
              error
            );
            // Continue with the next question
          }
        }

        // Validate consistency: all questions should be either coding or non-coding
        if (batchQuestions.length > 0) {
          const codingCount = batchQuestions.filter((q) => q.coding).length;
          const nonCodingCount = batchQuestions.filter((q) => !q.coding).length;

          const allCoding = codingCount === batchQuestions.length;
          const allNonCoding = nonCodingCount === batchQuestions.length;

          if (allCoding || allNonCoding) {
            // All questions are consistent, add them to skill questions
            skillQuestions.push(...batchQuestions);
            console.log(
              `Generated ${batchQuestions.length} consistent ${
                allCoding ? "coding" : "non-coding"
              } questions for skill ${skill.name}`
            );
          } else {
            // Mixed questions detected - determine which type to keep based on majority or existing questions
            let targetCoding = requiresCoding;

            if (!requiresCoding) {
              // If no existing preference, choose based on majority of generated questions
              targetCoding = codingCount > nonCodingCount;
            }

            console.log(
              `Mixed questions detected for skill ${
                skill.name
              } (${codingCount} coding, ${nonCodingCount} non-coding). Targeting ${
                targetCoding ? "coding" : "non-coding"
              } questions.`
            );

            // Update the skill coding status for future generations
            skillCodingStatus.set(skill.id, targetCoding);

            // Keep questions that match the target type and regenerate only the minority
            const correctTypeQuestions = batchQuestions.filter(
              (q) => q.coding === targetCoding
            );
            const wrongTypeQuestions = batchQuestions.filter(
              (q) => q.coding !== targetCoding
            );

            // Add the correct type questions to skill questions
            skillQuestions.push(...correctTypeQuestions);

            // Remove the wrong type question texts from existing texts to avoid duplicates
            const wrongTypeTexts = wrongTypeQuestions.map((q) => q.question);
            const filteredTexts = existingTexts.filter(
              (text) => !wrongTypeTexts.includes(text)
            );
            existingTexts.length = 0;
            existingTexts.push(...filteredTexts);

            console.log(
              `Kept ${correctTypeQuestions.length} correct ${
                targetCoding ? "coding" : "non-coding"
              } questions, will regenerate ${
                wrongTypeQuestions.length
              } questions.`
            );
          }
        }

        retryCount++;
      }

      // If we couldn't generate consistent questions after max retries, log warning
      if (skillQuestions.length < neededCount) {
        console.warn(
          `Could not generate all ${neededCount} consistent questions for skill ${skill.name}. Generated ${skillQuestions.length} questions.`
        );
      }

      // Store the consistent questions in database
      for (const question of skillQuestions) {
        try {
          const createdQuestion = await prisma.question.create({
            data: {
              content: JSON.stringify({
                question: question.question,
                answer: question.answer,
                category: question.category,
                difficulty: question.difficulty || skill.difficulty || "Medium",
                questionFormat: question.questionFormat || "Scenario",
                coding: question.coding,
              }),
              skillId: skill.id,
              recordId: id,
              coding: question.coding,
            },
          });

          // Add this question to our collection with all metadata
          allGeneratedQuestions.push({
            ...question,
            id: createdQuestion.id,
            skillId: skill.id,
            skillName: skill.name,
          });

          // Update count of total questions generated
          totalQuestionsGenerated++;

          // Update the existing count for next iterations
          existingQuestionCounts.set(
            skill.id,
            (existingQuestionCounts.get(skill.id) || 0) + 1
          );
        } catch (error) {
          console.error(
            `Error storing question for skill ${skill.name}:`,
            error
          );
        }
      }
    }

    const messagePrefix = specificSkillIds
      ? `Generated ${totalQuestionsGenerated} questions for ${record.skills.length} selected skills`
      : `Generated ${totalQuestionsGenerated} questions across ${record.skills.length} skills`;

    return NextResponse.json({
      success: true,
      message: `${messagePrefix} for ${record.jobTitle}`,
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
