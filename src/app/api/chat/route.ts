import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { createEmbedding } from '@/lib/embeddings';
import {
  storeJobDescriptionEmbedding,
  storeQuestionEmbedding,
  findSimilarJobDescriptions,
  findBestQuestions
} from '@/lib/supabase';

// Initialize Prisma client
const prisma = new PrismaClient();

// Create an OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, operation, params } = body;
    
    // Get the last user message
    const lastUserMessage = messages.findLast(
      (message: any) => message.role === 'user'
    );

    // Handle specific operations if provided
    if (operation === 'extract-skills') {
      return await handleExtractSkills(lastUserMessage.content, params);
    } else if (operation === 'auto-generate') {
      return await handleAutoGenerate(lastUserMessage.content, params);
    } else if (operation === 'edit-skill') {
      return await handleEditSkill(params);
    } else if (operation === 'edit-question') {
      return await handleEditQuestion(params);
    } else if (operation === 'regenerate-skills') {
      return await handleRegenerateSkills(params);
    } else if (operation === 'regenerate-auto') {
      return await handleRegenerateAuto(params);
    } else if (operation === 'regenerate-all') {
      return await handleRegenerateAll(params);
    }
    
    // If this appears to be a job description, try to extract skills
    if (lastUserMessage && 
       (lastUserMessage.content.includes('job description') || 
        lastUserMessage.content.length > 500)) {
      
      // Extract job title from the message
      const titleMatch = lastUserMessage.content.match(/job title[:\s]+(.*?)(?:\n|$)/i);
      let jobTitle = titleMatch ? titleMatch[1].trim() : 'Unknown Position';
      
      // Handle case where a job title wasn't explicitly provided
      if (jobTitle === 'Unknown Position') {
        // Use the OpenAI API to extract a likely job title
        const titleCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'Extract the most likely job title from this job description. Return only the job title without explanation.'
            },
            { role: 'user', content: lastUserMessage.content }
          ],
          temperature: 0.3,
        });
        
        if (titleCompletion.choices[0]?.message?.content) {
          jobTitle = titleCompletion.choices[0].message.content.trim();
        }
      }

      // Create a new record in the database
      const record = await prisma.skillRecord.create({
        data: {
          jobTitle: jobTitle,
          rawJobDescription: lastUserMessage.content,
          interviewLength: 60, // Default value, will be updated later
        },
      });

      // Process the job description to extract skills
      const skillPrompt = `
      You are an expert job skills analyzer. Extract the key skills from this job description.
      Categorize each skill by:
      - Level (BEGINNER, INTERMEDIATE, PROFESSIONAL, EXPERT)
      - Requirement (MANDATORY or OPTIONAL)
      - Category (TECHNICAL, FUNCTIONAL, BEHAVIORAL, COGNITIVE)
      
      For technical skills, add context about the technology or framework (e.g., "React" should specify version or ecosystem).
      For soft skills, be specific about the competency required.
      
      Format your response as JSON like this:
      {
        "skills": [
          {
            "name": "Skill name",
            "level": "BEGINNER|INTERMEDIATE|PROFESSIONAL|EXPERT",
            "requirement": "MANDATORY|OPTIONAL",
            "category": "TECHNICAL|FUNCTIONAL|BEHAVIORAL|COGNITIVE",
            "numQuestions": 1-3
          }
        ]
      }

     Extract 12-15 skills according to the custom instructions,interview length and the job description in total with a good mix of technical and non-technical skills.

   Number of skills: Depends on the interview length and the custom instructions.

      `;
      
      const skillCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: skillPrompt },
          { role: 'user', content: lastUserMessage.content }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });
      
      let skills = [];
      
      try {
        if (skillCompletion.choices[0]?.message?.content) {
          const parsedContent = JSON.parse(skillCompletion.choices[0].message.content);
          skills = parsedContent.skills || [];
          
          // Save the skills to the database
          for (let i = 0; i < skills.length; i++) {
            const skill = skills[i];
            await prisma.skill.create({
              data: {
                name: skill.name,
                level: skill.level,
                requirement: skill.requirement,
                category: skill.category || 'TECHNICAL',
                numQuestions: skill.numQuestions || 1,
                priority: i + 1,
                recordId: record.id,
              },
            });
          }
          
          // Generate a response that includes the recordId
          const aiResponse = `
          I've analyzed the job description and extracted ${skills.length} key skills required for this role.
          
          Skills Identified: ${skills.length}
          
          I've saved this information with recordId: ${record.id}`;
          
          const endResponse = `
          Would you like me to:
          1. Generate interview questions based on these skills?
          2. Edit or refine the skill list?
          3. Get insights about specific skills?
          `;
          
          // Add a JSON string representation for easier parsing on frontend
          const skillsJson = JSON.stringify({
            recordId: record.id,
            jobTitle,
            skills: skills.map((skill: any, index: number) => ({
              id: index.toString(),
              name: skill.name,
              level: skill.level,
              requirement: skill.requirement,
              category: skill.category || 'TECHNICAL',
              numQuestions: skill.numQuestions || 1
            }))
          });
          
          // Add the JSON data to the response for frontend parsing
          const fullResponse = `${aiResponse}\n\n<skills-data>${skillsJson}</skills-data>`;
          
          // For non-streaming response format that the AI SDK expects
          return NextResponse.json([{
            id: Date.now().toString(),
            role: "assistant",
            content: fullResponse
          }]);
        }
      } catch (parseError) {
        console.error('Error parsing skills JSON:', parseError);
      }
    }

    // For normal chat interactions, use OpenAI to respond (non-streaming)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a helpful AI assistant specialized in job interviews and recruitment.
          This is the current chat history:
          ${messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}
          `
        },
        ...messages,
      ],
      temperature: 0.7,
    });

    // Return the non-streaming response in the format expected by the AI SDK
    if (response.choices[0]?.message?.content) {
      return NextResponse.json([{
        id: Date.now().toString(),
        role: "assistant",
        content: response.choices[0].message.content
      }]);
    } else {
      return NextResponse.json([{
        id: Date.now().toString(),
        role: "assistant",
        content: "I'm sorry, I couldn't process that request."
      }]);
    }
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'An error occurred during chat processing' },
      { status: 500 }
    );
  }
}

// Handle extract-skills operation
async function handleExtractSkills(jobDescription: string, params: any) {
  try {
    const { 
      jobTitle = 'Unknown Position', 
      useLearningMode = false, 
      interviewLength = 60,
customInstructions = '',
jobDescription
    } = params || {};

    if (!jobDescription) {
      throw new Error("Job description is required");
    }

    // Create a new record in the database
    const record = await prisma.skillRecord.create({
      data: {
        jobTitle,
        rawJobDescription: jobDescription,
        interviewLength
      }
    });

    // Process the job description to extract skills
    const skillPrompt = `
    You are an expert job skills analyzer. Extract the key skills from this job description.
    Categorize each skill by:
    - Level (BEGINNER, INTERMEDIATE, PROFESSIONAL, EXPERT)
    - Requirement (MANDATORY or OPTIONAL)
    - Category (TECHNICAL, FUNCTIONAL, BEHAVIORAL, COGNITIVE)
    
    For technical skills, add context about the technology or framework (e.g., "React" should specify version or ecosystem).
    For soft skills, be specific about the competency required.
    
    Format your response as JSON like this:
    {
      "skills": [
        {
          "name": "Skill name",
          "level": "BEGINNER|INTERMEDIATE|PROFESSIONAL|EXPERT",
          "requirement": "MANDATORY|OPTIONAL",
          "category": "TECHNICAL|FUNCTIONAL|BEHAVIORAL|COGNITIVE"
        }
      ]
    }
    
   Extract 12-15 skills according to the custom instructions,interview length and the job description in total with a good mix of technical and non-technical skills.

   Number of skills: Depends on the interview length and the custom instructions.


    Here are 
    Job description: ${jobDescription}
    Custom instructions: ${customInstructions}
    Interview length: ${interviewLength}
    `;
    
    const skillCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: skillPrompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    
    let skills = [];
    
    try {
      if (skillCompletion.choices[0]?.message?.content) {
        const parsedContent = JSON.parse(skillCompletion.choices[0].message.content);
        skills = parsedContent.skills || [];
        
        // Save the skills to the database
        for (let i = 0; i < skills.length; i++) {
          const skill = skills[i];
          await prisma.skill.create({
            data: {
              name: skill.name,
              level: skill.level,
              requirement: skill.requirement,
              category: skill.category || 'TECHNICAL',
              numQuestions: skill.requirement === "MANDATORY" ? 2 : 1,
              priority: i + 1,
              recordId: record.id,
            },
          });
        }
        
        // Add a JSON string representation for easier parsing on frontend
        const skillsJson = JSON.stringify({
          recordId: record.id,
          jobTitle,
          skills: skills.map((skill: any, index: number) => ({
            id: index.toString(),
            name: skill.name,
            level: skill.level,
            requirement: skill.requirement,
            category: skill.category || 'TECHNICAL',
            numQuestions: skill.requirement === "MANDATORY" ? 2 : 1
          }))
        });
        
        // Generate a response that includes the recordId
        const aiResponse = `
        I've analyzed the job description and extracted ${skills.length} key skills required for this role.
        
        Skills Identified: ${skills.length}
        
        I've saved this information with recordId: ${record.id}`;
        
        const endResponse = `
        Would you like me to:
        1. Generate interview questions based on these skills?
        2. Edit or refine the skill list?
        3. Get insights about specific skills?
        `;
        
        // Add the JSON data to the response for frontend parsing
        const fullResponse = `${aiResponse}\n\n<skills-data>${skillsJson}</skills-data>`;
        
        // For non-streaming response format that the AI SDK expects
        return NextResponse.json([{
          id: Date.now().toString(),
          role: "assistant",
          content: fullResponse
        }]);
      }
    } catch (parseError) {
      console.error('Error parsing skills JSON:', parseError);
      throw parseError;
    }
    
    // Default error response
    throw new Error("Failed to extract skills from job description");
  } catch (error: any) {
    console.error('Error in extract-skills handler:', error);
    return NextResponse.json([{
      id: Date.now().toString(),
      role: "assistant", 
      content: `I'm sorry, I encountered an error while extracting skills: ${error.message}`
    }]);
  }
}

// Handle auto-generate operation
async function handleAutoGenerate(jobDescription: string, params: any) {
  try {
    const { 
      jobTitle = 'Unknown Position', 
      useLearningMode = false, 
      interviewLength = 60,
      customInstructions = '',
      jobDescription
    } = params || {};
    console.log("params", params);

    if (!jobDescription) {
      throw new Error("Job description is required");
    }

    // Create a new record in the database
    const record = await prisma.skillRecord.create({
      data: {
        jobTitle,
        rawJobDescription: jobDescription,
        interviewLength
      }
    });

    let skills = [];
    let createdSkills = [];
    
    // Use Supabase vector DB for learning mode
    if (useLearningMode) {
      // Generate embedding for the job description
      const embedding = await createEmbedding(jobDescription);
      
      // Find similar job descriptions from vector DB
      const similarJDs = await findSimilarJobDescriptions(embedding, 0.7, 3);
      
      // Extract skills using similar job descriptions as reference or AI if no similar JDs
      const skillsAnalysis = await extractSkillsWithLearning(
        jobTitle,
        jobDescription,
        interviewLength,
        similarJDs
      );
      
      skills = skillsAnalysis.skills || [];
      
      // Save the skills to the database
      for (let i = 0; i < skills.length; i++) {
        const skill = skills[i];
        const createdSkill = await prisma.skill.create({
          data: {
            name: skill.name,
            level: skill.level || "INTERMEDIATE",
            requirement: skill.importance === "high" ? "MANDATORY" : "OPTIONAL",
            category: skill.category || 'TECHNICAL',
            numQuestions: skill.importance === "high" ? 2 : 1,
            priority: i + 1,
            recordId: record.id,
            difficulty: skill.difficulty || "Medium",
          },
        });
        createdSkills.push(createdSkill);
      }
      
      // Store JD embedding in vector DB for future reference
      await storeJobDescriptionEmbedding(
        record.id,
        jobTitle,
        jobDescription,
        embedding,
        interviewLength,
        customInstructions
      );
    } else {
      // First extract skills using regular approach
      const skillPrompt = `
      You are an expert job skills analyzer. Extract the key skills from this job description.
      Categorize each skill by:
      - Level (BEGINNER, INTERMEDIATE, PROFESSIONAL, EXPERT)
      - Requirement (MANDATORY or OPTIONAL)
      - Category (TECHNICAL, FUNCTIONAL, BEHAVIORAL, COGNITIVE)
      
      For technical skills, add context about the technology or framework (e.g., "React" should specify version or ecosystem).
      For soft skills, be specific about the competency required.
      
      Format your response as JSON like this:
      {
        "skills": [
          {
            "name": "Skill name",
            "level": "BEGINNER|INTERMEDIATE|PROFESSIONAL|EXPERT",
            "requirement": "MANDATORY|OPTIONAL",
            "category": "TECHNICAL|FUNCTIONAL|BEHAVIORAL|COGNITIVE"
          }
        ]
      }
      
      Extract 12-15 skills according to the custom instructions,interview length and the job description in total with a good mix of technical and non-technical skills.

      Number of skills: Depends on the interview length and the custom instructions.


      Here are 
      Job description: ${jobDescription}
      Custom instructions: ${customInstructions}
      Interview length: ${interviewLength}
      `;
      
      const skillCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: skillPrompt }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });
      
      try {
        if (skillCompletion.choices[0]?.message?.content) {
          const parsedContent = JSON.parse(skillCompletion.choices[0].message.content);
          skills = parsedContent.skills || [];
          
          // Save the skills to the database
          for (let i = 0; i < skills.length; i++) {
            const skill = skills[i];
            const createdSkill = await prisma.skill.create({
              data: {
                name: skill.name,
                level: skill.level,
                requirement: skill.requirement,
                category: skill.category || 'TECHNICAL',
                numQuestions: skill.requirement === "MANDATORY" ? 2 : 1,
                priority: i + 1,
                recordId: record.id,
              },
            });
            createdSkills.push(createdSkill);
          }
        }
      } catch (parseError) {
        console.error('Error parsing skills JSON:', parseError);
        throw parseError;
      }
    }
    
    // Generate questions based on skills using learning mode if enabled
    const questions = await generateQuestionsWithMode(jobDescription, createdSkills, customInstructions, interviewLength, useLearningMode);
    
    // Add a JSON string representation for easier parsing on frontend
    const skillsJson = JSON.stringify({
      recordId: record.id,
      jobTitle,
      skills: createdSkills.map((skill: any) => ({
        id: skill.id,
        name: skill.name,
        level: skill.level,
        requirement: skill.requirement,
        category: skill.category || 'TECHNICAL',
        numQuestions: skill.numQuestions || 1
      }))
    });
    
    // Format questions for frontend
    const questionsJson = JSON.stringify({
      recordId: record.id,
      questions: questions.map((q: any) => ({
        id: q.id,
        skillId: q.skillId,
        skillName: getSkillName(createdSkills, q.skillId),
        content: q.content
      }))
    });
    
    // Generate a response that includes the recordId
    const aiResponse = `
    I've analyzed the job description and automatically generated both skills and interview questions.
    
    Skills Identified: ${createdSkills.length}
    Questions Generated: ${questions.length}
    
    I've saved this information with recordId: ${record.id}`;
    
    // Add the JSON data to the response for frontend parsing
    const fullResponse = `${aiResponse}\n\n<skills-data>${skillsJson}</skills-data>\n\n<questions-data>${questionsJson}</questions-data>`;
    
    // For non-streaming response format that the AI SDK expects
    return NextResponse.json([{
      id: Date.now().toString(),
      role: "assistant",
      content: fullResponse
    }]);
  } catch (error: any) {
    console.error('Error in auto-generate handler:', error);
    return NextResponse.json([{
      id: Date.now().toString(),
      role: "assistant",
      content: `I'm sorry, I encountered an error while generating skills and questions: ${error.message}`
    }]);
  }
}

// Helper function to get skill name from skills array
function getSkillName(skills: any[], skillId: string): string {
  const skill = skills.find(s => s.id === skillId);
  return skill ? skill.name : "Unknown Skill";
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

    let userPrompt = `Job Description:\n${jobDescription}\n\nExtract the key skills needed for this role.`;

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

// Generate questions based on skills, with optional learning mode
async function generateQuestionsWithMode(
  jobDescription: string,
  skills: any[],
  customInstructions: string,
  interviewLength: number,
  useLearningMode: boolean
) {
  if (useLearningMode) {
    return await generateQuestionsWithLearning(skills, customInstructions || "", interviewLength);
  } else {
    return await generateQuestions(jobDescription, skills, customInstructions, interviewLength);
  }
}

// Generate questions using learning mode (with vector similarity)
async function generateQuestionsWithLearning(
  skills: any[],
  customInstructions: string,
  interviewLength: number = 60
) {
  try {
    // Calculate total questions based on interview length
    const totalAvailableTime = interviewLength - 10; // Reserve 10 min for intro/wrap-up
    const avgTimePerQuestion = 4; // Average 4 minutes per question
    const maxQuestions = Math.floor(totalAvailableTime / avgTimePerQuestion);
    
    // Filter skills for questions
    const skillsForQuestions = skills.filter(
      (skill) => skill.requirement === "MANDATORY" || skill.numQuestions > 0
    );
    
    if (skillsForQuestions.length === 0) {
      return [];
    }
    
    // Create job description embedding to find similar questions
    const jobDescriptionText = skillsForQuestions.map(s => s.name).join(", ");
    const embedding = await createEmbedding(jobDescriptionText);
    
    // Get skill names for question generation
    const skillNames = skillsForQuestions.map(skill => skill.name);
    
    // Try to find existing good questions for similar job skills
    const existingQuestions = await findBestQuestions(
      embedding,
      skillNames,
      maxQuestions
    );
    
    // Reuse existing questions if available
    const reuseQuestions: any[] = [];
    const skillsNeedingQuestions = new Set(skillsForQuestions.map(s => s.name));
    
    if (existingQuestions.length > 0) {
      for (const question of existingQuestions) {
        if (
          reuseQuestions.length < maxQuestions && 
          skillsNeedingQuestions.has(question.skill_name)
        ) {
          // Create a properly formatted content object
          let contentObj;
          try {
            contentObj = {
              question: question.content,
              answer: "Review the candidate's response for accuracy and understanding.",
              category: "Technical",
              difficulty: "Medium",
              questionFormat: "Open-ended"
            };
          } catch (e) {
            contentObj = {
              question: question.content,
              answer: "Answer not available",
              category: "Technical",
              difficulty: "Medium",
              questionFormat: "Open-ended"
            };
          }
          
          // Create question in database
          const createdQuestion = await prisma.question.create({
            data: {
              content: JSON.stringify(contentObj),
              skillId: skills.find(s => s.name === question.skill_name)?.id,
              recordId: skills[0].recordId,
            }
          });
          
          reuseQuestions.push(createdQuestion);
          
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
    
    // Otherwise, generate additional questions with AI for remaining skills
    const remainingSkills = skillsForQuestions.filter(
      skill => skillsNeedingQuestions.has(skill.name) && skill.numQuestions > 0
    );
    
    // Generate new questions for remaining skills
    const newQuestions = await generateQuestions("", remainingSkills, customInstructions, interviewLength);
    
    // Store question embeddings for future reuse
    for (const question of newQuestions) {
      try {
        // Extract question text for embedding
        let questionText = '';
        try {
          const parsedContent = JSON.parse(question.content);
          questionText = parsedContent.question || String(parsedContent);
        } catch (e) {
          questionText = typeof question.content === 'string' ? question.content : 'Fallback question text';
        }
        
        // Generate embedding for the question
        const embedding = await createEmbedding(questionText);
        
        // Find matching skill
        const matchingSkill = skills.find(s => s.id === question.skillId);
        
        // Store in vector DB
        await storeQuestionEmbedding(
          question.id,
          questionText,
          matchingSkill?.name || 'Unknown Skill',
          matchingSkill?.level || 'INTERMEDIATE',
          matchingSkill?.requirement || 'MANDATORY',
          embedding
        );
      } catch (e) {
        console.error("Failed to create or store question embedding:", e);
      }
    }
    
    // Combine reused and newly generated questions, respecting maxQuestions limit
    return [...reuseQuestions, ...newQuestions].slice(0, maxQuestions);
  } catch (error) {
    console.error("Error generating questions with learning:", error);
    return [];
  }
}

// Generate questions for skills
async function generateQuestions(jobDescription: string, skills: any[], customInstructions: string, interviewLength: number) {
  try {
    // Calculate how many questions to generate
    const totalAvailableTime = interviewLength - 10; // Reserve 10 min for intro/wrap-up
    const avgTimePerQuestion = 4; // Average 4 minutes per question
    const maxQuestions = Math.floor(totalAvailableTime / avgTimePerQuestion);
    
    // Filter for mandatory skills first
    const mandatorySkills = skills.filter(skill => skill.requirement === 'MANDATORY');
    const optionalSkills = skills.filter(skill => skill.requirement === 'OPTIONAL');
    
    // Combine with priority to mandatory skills
    const prioritizedSkills = [...mandatorySkills, ...optionalSkills].slice(0, Math.min(8, skills.length));
    
    // Generate questions prompt
    const questionPrompt = `Generate interview questions for a ${skills[0]?.jobTitle || 'candidate'} position based on these skills:
${prioritizedSkills
  .map(
    (skill, index) =>
      `${index + 1}. ${skill.name} (${skill.level.toLowerCase()} level, ${skill.category.toLowerCase()} category)`
  )
  .join("\n")}

Generate up to ${maxQuestions} questions in total, prioritizing mandatory skills.
Each question should:
- Be relevant to the skill
- Match the appropriate difficulty level (Easy, Medium, Hard based on skill level)
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
      "category": "One of: Technical, Experience, Problem Solving, Soft Skills",
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
      throw new Error("Failed to generate questions");
    }
    
    // Parse the AI-generated questions
    const parsedContent = JSON.parse(content);
    const aiGeneratedQuestions = parsedContent.questions || [];
    
    // Match questions to skills and save to database
    const createdQuestions = await Promise.all(
      aiGeneratedQuestions.map(async (q: any) => {
        // Find matching skill
        const matchingSkill = skills.find(
          s => s.name.toLowerCase() === q.skillName?.toLowerCase()
        );
        
        if (!matchingSkill) {
          // Use the first skill as a fallback
          console.log(`No matching skill found for "${q.skillName}", using first skill instead`);
          const defaultSkill = skills[0];
          
          if (!defaultSkill) {
            console.error("No skills available for fallback");
            return null;
          }
          
          // Create question with default skill
          return await prisma.question.create({
            data: {
              content: JSON.stringify({
                question: q.question,
                answer: q.answer,
                category: q.category || "Technical",
                difficulty: q.difficulty || "Medium",
                questionFormat: q.questionFormat || "Open-ended"
              }),
              skillId: defaultSkill.id,
              recordId: defaultSkill.recordId,
            }
          });
        }
        
        // Create question with matching skill
        return await prisma.question.create({
          data: {
            content: JSON.stringify({
              question: q.question,
              answer: q.answer,
              category: q.category || "Technical",
              difficulty: q.difficulty || "Medium",
              questionFormat: q.questionFormat || "Open-ended"
            }),
            skillId: matchingSkill.id,
            recordId: matchingSkill.recordId,
          }
        });
      })
    );
    
    // Filter out any null values and return
    return createdQuestions.filter(Boolean);
  } catch (error) {
    console.error("Error generating questions:", error);
    return []; // Return empty array if generation fails
  }
}

// Handle edit-skill operation
async function handleEditSkill(params: any) {
  try {
    const { recordId, skillName, jobDescription } = params || {};

    if (!recordId) {
      throw new Error("Record ID is required");
    }

    if (!skillName) {
      throw new Error("Skill name is required");
    }

    // Get the record and skills from the database
    const record = await prisma.skillRecord.findUnique({
      where: { id: recordId },
      include: { skills: true }
    });

    if (!record) {
      throw new Error("Record not found");
    }

    // Find the skill that best matches the user's input
    const skill = record.skills.find(s => 
      s.name.toLowerCase().includes(skillName.toLowerCase()) || 
      skillName.toLowerCase().includes(s.name.toLowerCase())
    );

    if (!skill) {
      // If no matching skill found, return a message asking for clarification
      return NextResponse.json([{
        id: Date.now().toString(),
        role: "assistant",
        content: `I couldn't find a skill matching "${skillName}". Please specify one of the following skills:\n\n${record.skills.map(s => s.name).join('\n')}`
      }]);
    }

    // Create a prompt for editing the skill
    const editPrompt = `
    You are editing a skill for a job interview preparation system. 
    
    User has requested to edit the skill name: ${skillName}

    This is the current record:
    ${JSON.stringify(record)}

    
    Please revise this skill based on the job description. You can adjust the name, level, requirement, or category.
    Update the skill name that will suit the job description which is completely different from the current skill name.
    
    Job Description: ${jobDescription || record.rawJobDescription}
    
    Format your response as JSON:
    {
      "skill": {
        "name": "Revised skill name",
        "level": "BEGINNER|INTERMEDIATE|PROFESSIONAL|EXPERT",
        "requirement": "MANDATORY|OPTIONAL",
        "category": "TECHNICAL|FUNCTIONAL|BEHAVIORAL|COGNITIVE"
      }
    }
    `;
    
    // Use AI to revise the skill
    const skillCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: editPrompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    
    let updatedSkill;
    
    try {
      if (skillCompletion.choices[0]?.message?.content) {
        const parsedContent = JSON.parse(skillCompletion.choices[0].message.content);
        updatedSkill = parsedContent.skill;
        
        // Update the skill in the database
        await prisma.skill.update({
          where: { id: skill.id },
          data: {
            name: updatedSkill.name,
            level: updatedSkill.level,
            requirement: updatedSkill.requirement,
            category: updatedSkill.category,
          },
        });
        
        // Get all skills after update
        const updatedRecord = await prisma.skillRecord.findUnique({
          where: { id: recordId },
          include: { skills: true }
        });
        
        if (!updatedRecord) {
          throw new Error("Failed to retrieve updated record");
        }

        // Add a JSON string representation for easier parsing on frontend
        const skillsJson = JSON.stringify({
          recordId: recordId,
          jobTitle: record.jobTitle,
          skills: updatedRecord.skills.map((s: any) => ({
            id: s.id,
            name: s.name,
            level: s.level,
            requirement: s.requirement,
            category: s.category || 'TECHNICAL',
            numQuestions: s.numQuestions || 1
          }))
        });
        
        // Generate a response
        const aiResponse = `
        I've updated the skill "${skill.name}" to "${updatedSkill.name}" with the following details:
        
        - Level: ${updatedSkill.level}
        - Requirement: ${updatedSkill.requirement}
        - Category: ${updatedSkill.category}
        
        All skills have been updated in your record.`;
        
        // Add the JSON data to the response for frontend parsing
        const fullResponse = `${aiResponse}\n\n<skills-data>${skillsJson}</skills-data>\n\nIs there anything else you'd like to modify or edit?`;
        
        return NextResponse.json([{
          id: Date.now().toString(),
          role: "assistant",
          content: fullResponse
        }]);
      }
    } catch (parseError) {
      console.error('Error parsing skill JSON:', parseError);
      throw parseError;
    }
    
    throw new Error("Failed to update skill");
  } catch (error: any) {
    console.error('Error in edit-skill handler:', error);
    return NextResponse.json([{
      id: Date.now().toString(),
      role: "assistant",
      content: `I'm sorry, I encountered an error while editing the skill: ${error.message}`
    }]);
  }
}

// Handle edit-question operation
async function handleEditQuestion(params: any) {
  try {
    const { recordId, questionTopic } = params || {};

    if (!recordId) {
      throw new Error("Record ID is required");
    }

    if (!questionTopic) {
      throw new Error("Question topic is required");
    }

    // Get the record and questions from the database
    const record = await prisma.skillRecord.findUnique({
      where: { id: recordId },
      include: { 
        skills: true,
        questions: true 
      }
    });

    if (!record) {
      throw new Error("Record not found");
    }

    // Find all questions and parse their content
    const questionsList = record.questions.map(q => {
      try {
        const content = JSON.parse(q.content);
        return {
          id: q.id,
          skillId: q.skillId,
          question: content.question,
          answer: content.answer,
          category: content.category,
          difficulty: content.difficulty,
          questionFormat: content.questionFormat
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    // Find the question that best matches the user's input
    const question = questionsList.find(q => 
      q?.question.toLowerCase().includes(questionTopic.toLowerCase()) ||
      questionTopic.toLowerCase().includes((q?.question || "").toLowerCase().substring(0, 20))
    );

    if (!question) {
      // If no matching question found, return a message asking for clarification
      return NextResponse.json([{
        id: Date.now().toString(),
        role: "assistant",
        content: `I couldn't find a question matching "${questionTopic}". Please try to be more specific or mention a key part of the question text.`
      }]);
    }

    // Find the skill related to this question
    const relatedSkill = record.skills.find(s => s.id === question.skillId);
    
    // Create a prompt for editing the question
    const editPrompt = `
    You are editing an interview question for a job interview preparation system.
    
    User has requested to edit the question details:
    - Question: ${question.question}
    - Answer: ${question.answer}
    - Category: ${question.category}
    - Difficulty: ${question.difficulty}
    - Format: ${question.questionFormat || "Open-ended"}
    ${relatedSkill ? `- Related skill: ${relatedSkill.name} (${relatedSkill.level}, ${relatedSkill.category})` : ""}

    This is the current record:
    ${JSON.stringify(record)}
    
    Please revise this question to make it more effective for interviewing candidates.
    You can adjust the question text, suggested answer, category, difficulty, or format.
    Update the question text that will suit the job description.
    
    Format your response as JSON:
    {
      "question": {
        "question": "Revised question text",
        "answer": "Revised suggested answer",
        "category": "One of: Technical, Experience, Problem Solving, Soft Skills",
        "difficulty": "One of: Easy, Medium, Hard",
        "questionFormat": "One of: Open-ended, Coding, Scenario, Case Study, Design, Live Assessment"
      }
    }
    `;
    
    // Use AI to revise the question
    const questionCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: editPrompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    
    let updatedQuestion;
    
    try {
      if (questionCompletion.choices[0]?.message?.content) {
        const parsedContent = JSON.parse(questionCompletion.choices[0].message.content);
        updatedQuestion = parsedContent.question;
        
        // Update the question in the database
        await prisma.question.update({
          where: { id: question.id },
          data: {
            content: JSON.stringify({
              question: updatedQuestion.question,
              answer: updatedQuestion.answer,
              category: updatedQuestion.category,
              difficulty: updatedQuestion.difficulty,
              questionFormat: updatedQuestion.questionFormat
            }),
          },
        });
        
        // Get all questions after update
        const updatedRecord = await prisma.skillRecord.findUnique({
          where: { id: recordId },
          include: { 
            skills: true,
            questions: true 
          }
        });
        
        if (!updatedRecord) {
          throw new Error("Failed to retrieve updated record");
        }

        // Format questions for frontend
        const questionsJson = JSON.stringify({
          recordId: recordId,
          questions: updatedRecord.questions.map((q: any) => {
            try {
              const content = JSON.parse(q.content);
              return {
                id: q.id,
                skillId: q.skillId,
                skillName: updatedRecord.skills.find(s => s.id === q.skillId)?.name || "Unknown",
                question: content.question,
                answer: content.answer,
                category: content.category,
                difficulty: content.difficulty,
                questionFormat: content.questionFormat
              };
            } catch (e) {
              return null;
            }
          }).filter(Boolean)
        });
        
        // Generate a response
        const aiResponse = `
        I've updated the question to:
        
        "${updatedQuestion.question}"
        
        With the following details:
        - Category: ${updatedQuestion.category}
        - Difficulty: ${updatedQuestion.difficulty}
        - Format: ${updatedQuestion.questionFormat}
        
        All questions have been updated in your record.`;
        
        // Add the JSON data to the response for frontend parsing
        const fullResponse = `${aiResponse}\n\n<questions-data>${questionsJson}</questions-data>\n\nIs there anything else you'd like to modify or edit?`;
        
        return NextResponse.json([{
          id: Date.now().toString(),
          role: "assistant",
          content: fullResponse
        }]);
      }
    } catch (parseError) {
      console.error('Error parsing question JSON:', parseError);
      throw parseError;
    }
    
    throw new Error("Failed to update question");
  } catch (error: any) {
    console.error('Error in edit-question handler:', error);
    return NextResponse.json([{
      id: Date.now().toString(),
      role: "assistant",
      content: `I'm sorry, I encountered an error while editing the question: ${error.message}`
    }]);
  }
}

// Handle regenerate-skills operation
async function handleRegenerateSkills(params: any) {
  try {
    const { 
      recordId,
      jobDescription,
      useLearningMode = false, 
      interviewLength = 60,
      customInstructions = '' 
    } = params || {};

    if (!recordId) {
      throw new Error("Record ID is required");
    }

    // Get the record from the database
    const record = await prisma.skillRecord.findUnique({
      where: { id: recordId },
      include: { skills: true }
    });

    if (!record) {
      throw new Error("Record not found");
    }

    // Delete existing skills for this record
    await prisma.skill.deleteMany({
      where: { recordId: recordId }
    });

    // Process the job description with custom instructions
    const skillPrompt = `
    You are an expert job skills analyzer. Extract the key skills from this job description.
    Categorize each skill by:
    - Level (BEGINNER, INTERMEDIATE, PROFESSIONAL, EXPERT)
    - Requirement (MANDATORY or OPTIONAL)
    - Category (TECHNICAL, FUNCTIONAL, BEHAVIORAL, COGNITIVE)
    
    For technical skills, add context about the technology or framework (e.g., "React" should specify version or ecosystem).
    For soft skills, be specific about the competency required.
    
    Format your response as JSON like this:
    {
      "skills": [
        {
          "name": "Skill name",
          "level": "BEGINNER|INTERMEDIATE|PROFESSIONAL|EXPERT",
          "requirement": "MANDATORY|OPTIONAL",
          "category": "TECHNICAL|FUNCTIONAL|BEHAVIORAL|COGNITIVE"
        }
      ]
    }
    
    Extract 12-15 skills according to the job description in total with a good mix of technical and non-technical skills.

    ${customInstructions ? `Additional instructions: ${customInstructions}` : ''}

    Job description: ${jobDescription || record.rawJobDescription}
    `;
    
    const skillCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: skillPrompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    
    let skills = [];
    
    try {
      if (skillCompletion.choices[0]?.message?.content) {
        const parsedContent = JSON.parse(skillCompletion.choices[0].message.content);
        skills = parsedContent.skills || [];
        
        // Save the skills to the database
        for (let i = 0; i < skills.length; i++) {
          const skill = skills[i];
          await prisma.skill.create({
            data: {
              name: skill.name,
              level: skill.level,
              requirement: skill.requirement,
              category: skill.category || 'TECHNICAL',
              numQuestions: skill.requirement === "MANDATORY" ? 2 : 1,
              priority: i + 1,
              recordId: record.id,
            },
          });
        }
        
        // Add a JSON string representation for easier parsing on frontend
        const skillsJson = JSON.stringify({
          recordId: record.id,
          jobTitle: record.jobTitle,
          skills: skills.map((skill: any, index: number) => ({
            id: index.toString(),
            name: skill.name,
            level: skill.level,
            requirement: skill.requirement,
            category: skill.category || 'TECHNICAL',
            numQuestions: skill.requirement === "MANDATORY" ? 2 : 1
          }))
        });
        
        // Generate a response that includes the recordId
        const aiResponse = `
        I've regenerated the skills based on the job description and ${customInstructions ? 'your custom instructions' : 'standard analysis'}.
        
        Skills Identified: ${skills.length}
        `;
        
        const endResponse = `
        Would you like me to:
        1. Generate interview questions based on these skills?
        2. Edit or refine the skill list further?
        3. Get insights about specific skills?
        `;
        
        // Add the JSON data to the response for frontend parsing
        const fullResponse = `${aiResponse}\n\n<skills-data>${skillsJson}</skills-data>`;
        
        return NextResponse.json([{
          id: Date.now().toString(),
          role: "assistant",
          content: fullResponse
        }]);
      }
    } catch (parseError) {
      console.error('Error parsing skills JSON:', parseError);
      throw parseError;
    }
    
    throw new Error("Failed to regenerate skills");
  } catch (error: any) {
    console.error('Error in regenerate-skills handler:', error);
    return NextResponse.json([{
      id: Date.now().toString(),
      role: "assistant",
      content: `I'm sorry, I encountered an error while regenerating skills: ${error.message}`
    }]);
  }
}

// Handle regenerate-auto operation
async function handleRegenerateAuto(params: any) {
  try {
    const { 
      recordId,
      jobDescription,
      useLearningMode = false, 
      interviewLength = 60,
      customInstructions = '' 
    } = params || {};

    if (!recordId) {
      throw new Error("Record ID is required");
    }

    // Get the record from the database
    const record = await prisma.skillRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      throw new Error("Record not found");
    }

    // Delete existing skills and questions for this record
    await prisma.question.deleteMany({
      where: { recordId: recordId }
    });
    
    await prisma.skill.deleteMany({
      where: { recordId: recordId }
    });

    // Reuse the auto-generate function with the custom instructions
    return handleAutoGenerate(jobDescription || record.rawJobDescription, {
      jobTitle: record.jobTitle,
      useLearningMode,
      interviewLength,
      customInstructions,
      jobDescription: jobDescription || record.rawJobDescription
    });
  } catch (error: any) {
    console.error('Error in regenerate-auto handler:', error);
    return NextResponse.json([{
      id: Date.now().toString(),
      role: "assistant",
      content: `I'm sorry, I encountered an error while regenerating skills and questions: ${error.message}`
    }]);
  }
}

// Handle regenerate-all operation
async function handleRegenerateAll(params: any) {
  // This is just an alias for regenerate-auto
  return handleRegenerateAuto(params);
} 