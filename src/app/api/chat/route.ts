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
      
      Extract 12-15 skills in total with a good mix of technical and non-technical skills.
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
          
          Job Title: ${jobTitle}
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
          const fullResponse = `${aiResponse}\n\n<skills-data>${skillsJson}</skills-data>\n\n${endResponse}`;
          
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
          You can analyze job descriptions, extract required skills, and generate relevant interview questions.
          
          Your capabilities include:
          - Analyzing job descriptions to identify required skills
          - Categorizing skills by level, importance, and type
          - Generating tailored interview questions based on job requirements
          - Providing guidance on interviewing techniques
          
          When responding to job descriptions, be specific about skills extracted and how they relate to the role.
          Always format your responses in a clear, professional manner.
          When displaying lists or tables, use proper formatting to enhance readability.`
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
        
        Job Title: ${jobTitle}
        Skills Identified: ${skills.length}
        
        I've saved this information with recordId: ${record.id}`;
        
        const endResponse = `
        Would you like me to:
        1. Generate interview questions based on these skills?
        2. Edit or refine the skill list?
        3. Get insights about specific skills?
        `;
        
        // Add the JSON data to the response for frontend parsing
        const fullResponse = `${aiResponse}\n\n<skills-data>${skillsJson}</skills-data>\n\n${endResponse}`;
        
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
    
    Job Title: ${jobTitle}
    Skills Identified: ${createdSkills.length}
    Questions Generated: ${questions.length}
    
    I've saved this information with recordId: ${record.id}`;
    
    // Add the JSON data to the response for frontend parsing
    const fullResponse = `${aiResponse}\n\n<skills-data>${skillsJson}</skills-data>\n\n<questions-data>${questionsJson}</questions-data>\n\nYou can now view the skills and questions I've created for this job. Would you like me to explain any specific skill or question in more detail?`;
    
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