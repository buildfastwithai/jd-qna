import OpenAI from "openai";
import { prisma } from "./prisma";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Interface for skill metadata
interface SkillMetadata {
  id: string;
  numQuestions: number;
  difficulty: string;
  questionFormat?: string;
  category?: string;
}

// Generate prompt for a specific skill
const generatePrompt = (
  skillName: string,
  level: string,
  difficulty: string,
  questionFormat: string = "Scenario based",
  category: string = "TECHNICAL",
  batchSize: number = 1
) => {
  // Map skill level to difficulty if not provided
  const effectiveDifficulty =
    difficulty ||
    (level === "PROFESSIONAL"
      ? "Hard"
      : level === "INTERMEDIATE"
      ? "Medium"
      : "Easy");

  // Get the formatted category name
  const formattedCategory = formatCategory(category);

  return `Generate exactly ${batchSize} interview ${questionFormat.toLowerCase()} questions for the skill "${skillName}" at a ${level.toLowerCase()} level (${effectiveDifficulty} difficulty).
The questions should be for a ${formattedCategory.toLowerCase()} skill assessment, challenging but fair, testing both theoretical knowledge and practical application.

Format your response as a JSON object with a 'questions' key containing an array of question objects, where each object has:
1. A "question" field with the interview question (in ${questionFormat} format)
2. A "answer" field with a suggested model answer for the interviewer (should be comprehensive)
3. A "category" field with "${formattedCategory}"
4. A "difficulty" field with "${effectiveDifficulty}"
5. A "skillName" field with "${skillName}"

Make sure the questions match the specified difficulty level and are appropriate for the skill.
IMPORTANT: You must generate exactly ${batchSize} unique questions, no more and no less.`;
};

// Helper function to format category name
const formatCategory = (category: string = "TECHNICAL") => {
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
};

// Generate questions for multiple skills
export async function generateQuestionsForSkills(
  recordId: string,
  jobTitle: string,
  skills: SkillMetadata[]
) {
  try {
    if (!recordId || !skills || skills.length === 0) {
      return { success: false, error: "Record ID and skills are required" };
    }

    const allQuestions = [];

    // First, check how many questions already exist for each skill
    const skillIds = skills.map((skill) => skill.id);
    const existingQuestions = await prisma.question.findMany({
      where: {
        skillId: { in: skillIds },
        recordId: recordId,
      },
      select: {
        id: true,
        skillId: true,
      },
    });

    // Create a map of skill IDs to existing question counts
    const existingQuestionCounts = new Map<string, number>();
    existingQuestions.forEach((question) => {
      const currentCount = existingQuestionCounts.get(question.skillId) || 0;
      existingQuestionCounts.set(question.skillId, currentCount + 1);
    });

    // Get the skills from the database to access all metadata
    const dbSkills = await prisma.skill.findMany({
      where: {
        id: { in: skillIds },
        recordId: recordId,
      },
    });

    // Create a map of skill IDs to db skills for easier lookup
    const dbSkillsMap = new Map();
    dbSkills.forEach((skill) => {
      dbSkillsMap.set(skill.id, skill);
    });

    // Generate questions for each skill
    for (const skillMeta of skills) {
      // Get the skill from the database
      const dbSkill = dbSkillsMap.get(skillMeta.id);
      if (!dbSkill) {
        console.log(`Skill with ID ${skillMeta.id} not found. Skipping.`);
        continue;
      }

      // Determine how many questions to generate
      const requestedQuestions =
        skillMeta.numQuestions || dbSkill.numQuestions || 1;

      // Get number of existing questions
      const existingCount = existingQuestionCounts.get(skillMeta.id) || 0;

      // Calculate how many more questions we need to generate
      const questionsToGenerate = Math.max(
        0,
        requestedQuestions - existingCount
      );

      // Skip if we already have enough questions
      if (questionsToGenerate <= 0) {
        console.log(
          `Skill ${dbSkill.name} already has ${existingCount} questions. Skipping.`
        );
        continue;
      }

      // Get the difficulty and question format
      const difficulty = skillMeta.difficulty || dbSkill.difficulty || "Medium";
      const questionFormat =
        skillMeta.questionFormat || dbSkill.questionFormat || "Scenario based";
      const category = skillMeta.category || dbSkill.category || "TECHNICAL";

      console.log(
        `Generating ${questionsToGenerate} ${questionFormat} questions for ${dbSkill.name} (${category})`
      );

      // Generate prompt for this skill
      const prompt = generatePrompt(
        dbSkill.name,
        dbSkill.level,
        difficulty,
        questionFormat,
        category,
        questionsToGenerate
      );

      // Call OpenAI API
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert interviewer who creates relevant interview questions based on specific skills. Include detailed suggested answers for each question. You must generate EXACTLY ${questionsToGenerate} unique questions for the skill "${dbSkill.name}" - no more, no less.`,
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
        console.error(`No content returned for skill ${dbSkill.name}`);
        continue;
      }

      try {
        const parsedResponse = JSON.parse(content);

        if (
          parsedResponse.questions &&
          Array.isArray(parsedResponse.questions)
        ) {
          // Ensure we only process the exact number needed
          const questionsToProcess = parsedResponse.questions.slice(
            0,
            questionsToGenerate
          );

          // Add the skill ID to each question
          const questionsWithSkillId = questionsToProcess.map(
            (question: any) => ({
              ...question,
              skillId: skillMeta.id,
            })
          );

          // Save questions to the database
          for (const question of questionsWithSkillId) {
            await prisma.question.create({
              data: {
                content: JSON.stringify({
                  question: question.question,
                  answer: question.answer,
                  category: question.category,
                  difficulty: question.difficulty,
                }),
                skillId: skillMeta.id,
                recordId: recordId,
              },
            });
          }

          allQuestions.push(...questionsWithSkillId);

          // Update the existing question count for this skill
          existingQuestionCounts.set(
            skillMeta.id,
            (existingQuestionCounts.get(skillMeta.id) || 0) +
              questionsWithSkillId.length
          );
        }
      } catch (e) {
        console.error(`Error parsing questions for skill ${dbSkill.name}:`, e);
      }
    }

    return {
      success: true,
      questions: allQuestions,
      message: `Generated ${allQuestions.length} questions for ${jobTitle}`,
    };
  } catch (error: any) {
    console.error("Error generating skill questions:", error);
    return {
      success: false,
      error: error.message || "Failed to generate skill questions",
    };
  }
}
