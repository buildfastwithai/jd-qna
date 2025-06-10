import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: "Chat API test endpoint is working" 
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Check if the message is about a job description
    const userMessages = body.messages?.filter((m: any) => m.role === 'user') || [];
    const lastUserMessage = userMessages[userMessages.length - 1];
    
    if (lastUserMessage?.content?.toLowerCase().includes('job description')) {
      // Mock record ID for testing
      const testRecordId = '246299f-d98b-43f2-8a88-b6e3e4c9b837';
      
      // Sample skills data for testing
      const mockSkills = [
        {
          id: '1',
          name: 'React.js (v18+)',
          level: 'EXPERT',
          requirement: 'MANDATORY',
          category: 'TECHNICAL',
          numQuestions: 3,
          recordId: testRecordId
        },
        {
          id: '2',
          name: 'TypeScript',
          level: 'PROFESSIONAL',
          requirement: 'MANDATORY',
          category: 'TECHNICAL',
          numQuestions: 2,
          recordId: testRecordId
        },
        {
          id: '3',
          name: 'API Development',
          level: 'INTERMEDIATE',
          requirement: 'MANDATORY',
          category: 'TECHNICAL',
          numQuestions: 2,
          recordId: testRecordId
        },
        {
          id: '4',
          name: 'Communication',
          level: 'PROFESSIONAL',
          requirement: 'MANDATORY',
          category: 'BEHAVIORAL',
          numQuestions: 1,
          recordId: testRecordId
        }
      ];
      
      // Sample questions data for testing
      const mockQuestions = [
        {
          id: '1',
          skillId: '1',
          skillName: 'React.js (v18+)',
          content: JSON.stringify({
            question: "Explain how React's Concurrent Mode and Suspense work and how you would use them in a production application.",
            answer: "The answer should cover: Concurrent Mode allows React to work on multiple tasks simultaneously and prioritize them. Suspense enables components to \"wait\" for something before rendering, like data fetching. The candidate should mention practical uses like improved user experiences during data loading, smoother transitions, and more responsive interfaces.",
            category: "Technical",
            difficulty: "Hard",
            questionFormat: "Open-ended"
          })
        },
        {
          id: '2',
          skillId: '2',
          skillName: 'TypeScript',
          content: JSON.stringify({
            question: "How would you implement type-safe state management in a large React application?",
            answer: "Look for discussion of: Using TypeScript interfaces for state shape, leveraging generics with state management libraries, implementing discriminated unions for actions/reducers, proper typing of async operations, and approaches to ensure type safety across component boundaries.",
            category: "Technical",
            difficulty: "Medium",
            questionFormat: "Scenario"
          })
        },
        {
          id: '3',
          skillId: '3',
          skillName: 'API Development',
          content: JSON.stringify({
            question: "Describe your approach to designing a RESTful API for a new feature that allows users to create, share, and collaborate on documents.",
            answer: "Good answers will include: Resource modeling (users, documents, permissions), appropriate HTTP methods for CRUD operations, authentication/authorization considerations, pagination/filtering strategies, error handling approaches, and versioning strategy. They might also mention documentation tools like OpenAPI/Swagger.",
            category: "Technical",
            difficulty: "Medium",
            questionFormat: "Design"
          })
        },
        {
          id: '4',
          skillId: '4',
          skillName: 'Communication',
          content: JSON.stringify({
            question: "Tell me about a time when you had to explain a complex technical concept to a non-technical stakeholder. How did you approach it and what was the outcome?",
            answer: "Look for: Evidence of adapting communication style for the audience, use of analogies or visual aids, checking for understanding throughout, successful knowledge transfer, and positive outcomes from the interaction. Strong answers will show empathy for the non-technical perspective.",
            category: "Soft Skills",
            difficulty: "Medium",
            questionFormat: "Scenario"
          })
        }
      ];
      
      // Create JSON data structures
      const skillsJson = JSON.stringify({
        recordId: testRecordId,
        jobTitle: 'Senior Frontend Developer',
        skills: mockSkills
      });
      
      const questionsJson = JSON.stringify({
        recordId: testRecordId,
        questions: mockQuestions
      });
      
      // Create response with skills data
      const content = `
      I've analyzed the job description and extracted 4 key skills required for this role.
      
      **Job Title**: Senior Frontend Developer
      **Skills Identified**: 4
      
      I've saved this information with recordId: ${testRecordId}
      
      Below are the skills I've identified and some sample interview questions for each skill.
      
      <skills-data>${skillsJson}</skills-data>
      
      <questions-data>${questionsJson}</questions-data>
      
      Would you like me to:
      1. Generate more interview questions based on these skills?
      2. Edit or refine the skill list?
      3. Get insights about specific skills?
      `;
      
      // Return formatted response
      return NextResponse.json({
        role: "assistant",
        content: content
      });
    }
    
    // For regular messages
    return NextResponse.json({
      role: "assistant",
      content: "This is a test response from the chat-test API."
    });
  } catch (error) {
    console.error('Error in chat-test API:', error);
    return NextResponse.json(
      { error: 'An error occurred during processing' },
      { status: 500 }
    );
  }
} 