import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { createEmbedding } from '@/lib/embeddings';
import {
  storeJobDescriptionEmbedding,
  storeQuestionEmbedding,
  findSimilarJobDescriptions,
  findBestQuestions
} from '@/lib/supabase';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobRole, jobDescription, interviewLength, customInstructions } = body;

    if (!jobRole || !jobDescription) {
      return NextResponse.json({ 
        success: false, 
        error: "Job role and description are required" 
      }, { status: 400 });
    }

    // Create a record in the database
    const record = await prisma.skillRecord.create({
      data: {
        jobTitle: jobRole,
        rawJobDescription: jobDescription,
        interviewLength: interviewLength || 60,
      }
    });

    // Generate embedding for the job description
    const embedding = await createEmbedding(jobDescription);
    
    // Find similar job descriptions from vector DB
    const similarJDs = await findSimilarJobDescriptions(embedding, 0.7, 3);
    
    // Extract skills using similar job descriptions as reference or AI if no similar JDs
    const skillsAnalysis = await extractSkillsWithLearning(
      jobRole,
      jobDescription,
      interviewLength || 60,
      similarJDs
    );
    
    // Store skills in the database
    const createdSkills = await storeSkills(record.id, skillsAnalysis.skills);
    
    // Get skill names for question generation
    const skillNames = createdSkills.map(skill => skill.name);
    
    // Try to find existing good questions for similar job descriptions
    const existingQuestions = await findBestQuestions(
      embedding,
      skillNames,
      Math.floor((interviewLength || 60) / 4) // ~4 min per question
    );
    
    // Generate new questions if needed, or reuse existing questions
    let questions = [];
    try {
      questions = await generateQuestionsWithLearning(
        embedding,
        createdSkills,
        existingQuestions,
        customInstructions,
        interviewLength || 60
      );
    } catch (error) {
      console.error("Error in question generation:", error);
      // If question generation fails, create basic questions for each skill
      questions = generateBasicQuestions(createdSkills);
    }
    
    // Store questions in database and their embeddings
    await storeGeneratedQuestions(record.id, questions);

    // Store JD embedding in vector DB for future reference
    await storeJobDescriptionEmbedding(
      record.id,
      jobRole,
      jobDescription,
      embedding,
      interviewLength,
      customInstructions
    );

    return NextResponse.json({
      success: true,
      recordId: record.id,
    });
  } catch (error) {
    console.error('Error in auto-generate:', error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to auto-generate skills and questions" 
    }, { status: 500 });
  }
}

// Extract skills using AI, considering similar job descriptions if available
async function extractSkillsWithLearning(
  jobRole: string, 
  jobDescription: string, 
  interviewLength: number, 
  similarJDs: any[]
) {
  try {
    let systemPrompt = `You are a skilled recruiter analyzing job descriptions to extract required skills for interviews.
Extract skills from the job description and categorize them by:
- Importance: high (required) or low (preferred/optional)
- Level: BEGINNER, INTERMEDIATE, PROFESSIONAL, or EXPERT
- Category: TECHNICAL, FUNCTIONAL, BEHAVIORAL, or COGNITIVE
- Difficulty: Easy, Medium, or Hard

Return a JSON object with a 'skills' array, where each skill has:
- name: The skill name
- importance: high or low
- level: BEGINNER, INTERMEDIATE, PROFESSIONAL, or EXPERT
- category: TECHNICAL, FUNCTIONAL, BEHAVIORAL, or COGNITIVE
- difficulty: Easy, Medium, or Hard`;

    let userPrompt = `Job Title: ${jobRole}\n\nJob Description:\n${jobDescription}\n\nExtract the key skills needed for this role.`;

    // If we have similar JDs, add them as context
    if (similarJDs && similarJDs.length > 0) {
      systemPrompt += `\n\nI'll provide examples of similar job descriptions and their extracted skills. Use these as a reference to improve your skill extraction.`;
      userPrompt += `\n\nHere are skills from similar job descriptions that might be relevant:`;
      
      for (const similarJD of similarJDs) {
        userPrompt += `\n- ${similarJD.job_title}: Skills might include skills related to this role.`;
      }
    }

    // Call OpenAI to extract skills
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    // Parse the response
    const data = JSON.parse(content);
    
    return {
      skills: data.skills || [],
    };
  } catch (error: any) {
    console.error("Error extracting skills:", error);
    return {
      skills: [],
    };
  }
}

// Store skills in the database
async function storeSkills(recordId: string, skills: any[]) {
  const createdSkills = await Promise.all(
    skills.map(async (skill, index) => {
      // Ensure at least the first 3 skills are mandatory with questions
      const isHighPriority = index < 3 || skill.importance === "high";
      const isOptional = !isHighPriority && index >= 3;
      const numQuestions = index < 8 ? (isOptional ? 1 : 2) : 0;

      return await prisma.skill.create({
        data: {
          name: skill.name,
          level: skill.level || "INTERMEDIATE",
          requirement: isOptional ? "OPTIONAL" : "MANDATORY",
          numQuestions: numQuestions,
          difficulty: skill.difficulty || "Medium",
          recordId: recordId,
          priority: index + 1,
          category: skill.category || "TECHNICAL",
        },
      });
    })
  );

  return createdSkills;
}

// Generate questions using AI and existing questions
async function generateQuestionsWithLearning(
  embedding: number[],
  skills: any[],
  existingQuestions: any[] = [],
  customInstructions?: string,
  interviewLength: number = 60
) {
  try {
    // Filter skills for questions
    const skillsForQuestions = skills.filter(
      (skill) => skill.requirement === "MANDATORY" || skill.numQuestions > 0
    );
    
    if (skillsForQuestions.length === 0) {
      return [];
    }
    
    // Calculate total questions based on interview length
    const totalAvailableTime = interviewLength - 10; // Reserve 10 min for intro/wrap-up
    const avgTimePerQuestion = 4; // Average 4 minutes per question
    const maxQuestions = Math.floor(totalAvailableTime / avgTimePerQuestion);
    
    // Reuse existing questions if available
    const reuseQuestions: any[] = [];
    const skillsNeedingQuestions = new Set(skillsForQuestions.map(s => s.name));
    
    if (existingQuestions.length > 0) {
      for (const question of existingQuestions) {
        if (
          reuseQuestions.length < maxQuestions && 
          skillsNeedingQuestions.has(question.skill_name)
        ) {
          reuseQuestions.push({
            content: question.content,
            skillId: skills.find(s => s.name === question.skill_name)?.id,
            skillName: question.skill_name,
            skillLevel: question.skill_level,
            requirement: question.requirement,
            source: 'reused'
          });
          
          // Keep track of which skills have been covered
          const covered = skills.find(s => s.name === question.skill_name);
          if (covered) {
            covered.numQuestions--;
            if (covered.numQuestions <= 0) {
              skillsNeedingQuestions.delete(covered.name);
            }
          }
        }
      }
    }
    
    // If we've covered all skills with existing questions, return them
    if (skillsNeedingQuestions.size === 0 || reuseQuestions.length >= maxQuestions) {
      return reuseQuestions.slice(0, maxQuestions);
    }
    
    // Otherwise, generate additional questions with AI
    const remainingSkills = skillsForQuestions.filter(
      skill => skillsNeedingQuestions.has(skill.name) && skill.numQuestions > 0
    );
    
    const questionPrompt = `Generate interview questions for a ${skillsForQuestions[0].jobTitle || 'candidate'} position based on these skills:
${remainingSkills
  .map(
    (skill, index) =>
      `${index + 1}. ${skill.name} (${skill.level} level, ${
        skill.difficulty
      } difficulty, ${skill.numQuestions} questions)`
  )
  .join("\n")}

Generate questions for each skill according to the number specified in parentheses. 
Each question should:
- Be relevant to the skill
- Match the appropriate difficulty level
- Include a detailed suggested answer for the interviewer
- Be categorized as either Technical, Experience, Problem Solving, or Soft Skills
- Follow a professional interview question format

${customInstructions ? `Additional instructions: ${customInstructions}` : ""}`;

    const questionsResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert interviewer creating relevant interview questions for a candidate.
Your response MUST follow this exact JSON format:

{
  "questions": [
    {
      "question": "The interview question text",
      "answer": "A comprehensive suggested answer for the interviewer",
      "skillName": "The exact skill name this question tests (must match one of the provided skills exactly)",
      "category": "One of: Technical, Experience, Problem Solving, Soft Skills, Functional, Behavioral, Cognitive",
      "difficulty": "One of: Easy, Medium, Hard",
      "questionFormat": "One of: Open-ended, Coding, Scenario, Case Study, Design, Live Assessment"
    },
    ...more questions
  ]
}

The "questions" array MUST be the top-level property. Do not use any other format.`,
        },
        { role: "user", content: questionPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = questionsResponse.choices[0]?.message?.content;
    
    if (!content) {
      return reuseQuestions; // Return any reused questions if AI generation fails
    }
    
    // Parse the AI-generated questions
    let aiGeneratedQuestions = [];
    try {
      console.log("OpenAI response content:", content.substring(0, 200) + "...");
      const parsedContent = JSON.parse(content);
      
      // Handle different possible formats
      if (Array.isArray(parsedContent)) {
        console.log("Format: Direct array");
        aiGeneratedQuestions = parsedContent;
      } else if (parsedContent.questions && Array.isArray(parsedContent.questions)) {
        console.log("Format: Object with questions array");
        aiGeneratedQuestions = parsedContent.questions;
      } else {
        // Try to extract any array property that might contain questions
        console.log("Format: Unknown, trying to find array properties");
        const arrayProps = Object.keys(parsedContent).filter(key => 
          Array.isArray(parsedContent[key]) && 
          parsedContent[key].length > 0 &&
          parsedContent[key][0] && 
          typeof parsedContent[key][0] === 'object'
        );
        
        if (arrayProps.length > 0) {
          console.log(`Found array property: ${arrayProps[0]}`);
          aiGeneratedQuestions = parsedContent[arrayProps[0]];
        } else if (typeof parsedContent === 'object') {
          // If it's a single question object, wrap it in an array
          if (parsedContent.question && parsedContent.skillName) {
            console.log("Format: Single question object");
            aiGeneratedQuestions = [parsedContent];
          } else {
            console.log("Format: Object structure:", Object.keys(parsedContent));
            throw new Error(`Unexpected response format: ${JSON.stringify(parsedContent).substring(0, 100)}...`);
          }
        } else {
          throw new Error("Unexpected response format");
        }
      }
      
      // Convert to our unified question format
      const newQuestions = aiGeneratedQuestions.map((q: {
        question: string;
        answer: string;
        skillName?: string;
        category?: string;
        difficulty?: string;
        questionFormat?: string;
      }) => {
        const matchingSkill = skills.find(
          s => s.name.toLowerCase() === q.skillName?.toLowerCase()
        );
        
        if (!matchingSkill) return null;
        
        return {
          content: JSON.stringify({
            question: q.question,
            answer: q.answer,
            category: q.category || "Technical",
            difficulty: q.difficulty || "Medium",
            questionFormat: q.questionFormat || "Scenario",
          }),
          skillId: matchingSkill.id,
          skillName: matchingSkill.name,
          skillLevel: matchingSkill.level,
          requirement: matchingSkill.requirement,
          source: 'generated'
        };
      }).filter(Boolean);
      
      // Combine reused and newly generated questions, respecting maxQuestions limit
      return [...reuseQuestions, ...newQuestions].slice(0, maxQuestions);
    } catch (error) {
      console.error("Error processing questions:", error);
      return reuseQuestions; // Return any reused questions if parsing fails
    }
  } catch (error) {
    console.error("Error generating questions:", error);
    return [];
  }
}

// Store questions in database and their embeddings
async function storeGeneratedQuestions(recordId: string, questions: any[]) {
  // If no questions, generate fallback questions
  if (!questions || questions.length === 0) {
    console.log("No questions to store, generating fallback questions");
    return;
  }

  console.log(`Storing ${questions.length} questions to database`);
  
  const results = await Promise.allSettled(
    questions.map(async (question) => {
      try {
        // Validate question has required fields
        if (!question.skillId) {
          console.error("Question missing skillId:", question);
          return null;
        }
        
        // Create question in Prisma DB
        const createdQuestion = await prisma.question.create({
          data: {
            content: question.content,
            skillId: question.skillId,
            recordId,
          }
        });
        
        // Extract question text for embedding
        let questionText = '';
        try {
          const parsedContent = JSON.parse(question.content);
          questionText = parsedContent.question || String(parsedContent);
        } catch (e) {
          console.log("Failed to parse question content:", e);
          questionText = typeof question.content === 'string' ? question.content : 'Fallback question text';
        }
        
        // Generate embedding for the question
        try {
          const embedding = await createEmbedding(questionText);
          
          // Store in vector DB
          await storeQuestionEmbedding(
            createdQuestion.id,
            questionText,
            question.skillName || 'Unknown Skill',
            question.skillLevel || 'INTERMEDIATE',
            question.requirement || 'MANDATORY',
            embedding,
            question.source === 'reused' ? true : undefined // Mark reused questions as liked
          );
        } catch (e) {
          console.error("Failed to create or store embedding:", e);
        }
        
        return createdQuestion;
      } catch (error) {
        console.error("Error storing question:", error);
        return null;
      }
    })
  );
  
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  console.log(`Successfully stored ${successCount} out of ${questions.length} questions`);
}

// Fallback function to generate basic questions if AI generation fails
function generateBasicQuestions(skills: any[]): any[] {
  console.log("Using fallback question generation for", skills.length, "skills");
  
  return skills
    .filter(skill => skill.requirement === "MANDATORY" || skill.numQuestions > 0)
    .map(skill => {
      const questionsByLevel: Record<string, string[]> = {
        "BEGINNER": [
          `What is your experience with ${skill.name}?`,
          `Describe a basic use case for ${skill.name}.`,
          `How would you explain ${skill.name} to someone new to the field?`
        ],
        "INTERMEDIATE": [
          `Describe a challenging problem you solved using ${skill.name}.`,
          `What are the best practices when working with ${skill.name}?`,
          `How do you stay updated with new developments in ${skill.name}?`
        ],
        "PROFESSIONAL": [
          `Describe an advanced implementation of ${skill.name} you've worked on.`,
          `How have you optimized performance when using ${skill.name}?`,
          `What architectural decisions have you made regarding ${skill.name}?`
        ],
        "EXPERT": [
          `How have you contributed to the advancement of ${skill.name} in your field?`,
          `Describe a novel approach you've developed using ${skill.name}.`,
          `What innovations do you foresee in the future of ${skill.name}?`
        ]
      };
      
      const questions = questionsByLevel[skill.level] || questionsByLevel["INTERMEDIATE"];
      const questionIndex = Math.floor(Math.random() * questions.length);
      
      return {
        content: JSON.stringify({
          question: questions[questionIndex],
          answer: `Look for the candidate to demonstrate knowledge of ${skill.name} appropriate to a ${skill.level.toLowerCase()} level.`,
          category: "Technical",
          difficulty: "Medium",
          questionFormat: "Open-ended"
        }),
        skillId: skill.id,
        skillName: skill.name,
        skillLevel: skill.level,
        requirement: skill.requirement,
        source: 'fallback'
      };
    });
}
