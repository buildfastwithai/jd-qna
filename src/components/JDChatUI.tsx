"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat, type Message } from "ai/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  Download,
  RefreshCw,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Info
} from "lucide-react";
import { QuestionDialog } from "./ui/question-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

// Define interfaces similar to SkillRecordEditor
interface Skill {
  id: string;
  name: string;
  level: "BEGINNER" | "INTERMEDIATE" | "PROFESSIONAL" | "EXPERT";
  requirement: "MANDATORY" | "OPTIONAL";
  numQuestions: number;
  difficulty?: string;
  recordId: string;
  priority?: number;
  category?: "TECHNICAL" | "FUNCTIONAL" | "BEHAVIORAL" | "COGNITIVE";
  questionFormat?: string;
}

interface Question {
  id: string;
  content: string;
  skillId: string;
  recordId: string;
  liked?: "LIKED" | "DISLIKED" | "NONE";
  skill?: Skill;
  feedback?: string;
}

interface QuestionData {
  id: string;
  skillId: string;
  question: string;
  answer: string;
  category: string;
  difficulty: string;
  questionFormat?: string;
  liked?: "LIKED" | "DISLIKED" | "NONE";
  feedback?: string;
}

// Helper function to extract skills data from message content
function extractSkillsData(content: string) {
  if (!content) return null;
  
  // Try to find skills data in special tag
  const skillsDataRegex = new RegExp('<skills-data>(.*?)</skills-data>', 'gmi');
  const skillsMatch = skillsDataRegex.exec(content);
  
  if (skillsMatch && skillsMatch[1]) {
    try {
      return JSON.parse(skillsMatch[1]);
    } catch (error) {
      console.error("Error parsing skills JSON:", error);
    }
  }
  
  return null;
}

// Helper function to extract questions data from message content
function extractQuestionsData(content: string) {
  if (!content) return null;
  
  // Try to find questions data in special tag
  const questionsDataRegex = new RegExp('<questions-data>(.*?)</questions-data>', 'gmi');
  const questionsMatch = questionsDataRegex.exec(content);
  
  if (questionsMatch && questionsMatch[1]) {
    try {
      return JSON.parse(questionsMatch[1]);
    } catch (error) {
      console.error("Error parsing questions JSON:", error);
    }
  }
  
  return null;
}

export default function JDChatUI() {
  const router = useRouter();
  const [recordId, setRecordId] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false); // Set to true to use test endpoint

  // Local state for managing messages and loading state
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [localLoading, setLocalLoading] = useState(false);

  // Define conversation state management
  const [conversationState, setConversationState] = useState({
    stage: 'initial', // initial, jd_provided, learning_mode, interview_length, custom_instructions, options
    jobDescription: '',
    useLearningMode: false,
    interviewLength: 60,
    customInstructions: '',
  });

  // Initialize the chat with the correct API endpoint
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: debugMode ? "/api/chat-test" : "/api/chat",
    onResponse: (response) => {
      console.log("Got response:", response);
    },
    onError: (error) => {
      console.error("Chat error:", error);
      toast.error("Error in chat: " + error.message);
    }
  });

  console.log("Current messages:", messages);

  // Log any errors
  useEffect(() => {
    if (error) {
      console.error("Chat hook error:", error);
      toast.error("Error: " + error.message);
    }
  }, [error]);

  // Parse question content from JSON string (similar to SkillRecordEditor)
  function formatQuestions(questions: Question[]): QuestionData[] {
    return questions
      .map((q) => {
        try {
          const content = JSON.parse(q.content);
          return {
            id: q.id,
            skillId: q.skillId,
            question: content.question,
            answer: content.answer,
            category: content.category,
            difficulty: content.difficulty,
            questionFormat: content.questionFormat || "Scenario",
            liked: q.liked || "NONE",
            feedback: q.feedback || "",
          };
        } catch (e) {
          console.error("Error parsing question content:", e);
          return null;
        }
      })
      .filter(Boolean) as QuestionData[];
  }

  // Define fetchRecordData function before it's used in the useEffect
  const fetchRecordData = async (id: string) => {
    if (!id) return;
    
    setLoading(true);
    try {
      console.log("Fetching record data for:", id);
      const response = await fetch(`/api/records/${id}`);
      const data = await response.json();
      
      if (data.success && data.record) {
        console.log("Record data:", data.record);
        setSkills(data.record.skills);
        setQuestions(formatQuestions(data.record.questions));
        toast.success(`Loaded ${data.record.skills.length} skills successfully!`);
      }
    } catch (error) {
      console.error("Error fetching record data:", error);
      toast.error("Failed to load job details");
    } finally {
      setLoading(false);
    }
  };

  // Test API connection on component mount
  useEffect(() => {
    const testApiConnection = async () => {
      try {
        const response = await fetch('/api/chat-test');
        const data = await response.json();
        console.log("API test result:", data);
        toast.success("API connection successful");
      } catch (error) {
        console.error("API test error:", error);
        toast.error("API connection failed");
      }
    };
    
    testApiConnection();
  }, []);

  // Update the useEffect with improved skills extraction
  useEffect(() => {
    console.log("Checking messages for skills data");
    
    // Look for a message with skills data
    const messagesToCheck = localMessages.length > 0 ? localMessages : messages;
    
    for (const message of messagesToCheck) {
      if (message.role === 'assistant' && message.content) {
        console.log("Checking message for skills data");
        
        // Try to extract skills data
        const skillsData = extractSkillsData(message.content);
        
        if (skillsData) {
          console.log("Found skills data:", skillsData);
          
          // Set recordId
          setRecordId(skillsData.recordId);
          
          // Set skills directly from parsed JSON
          setSkills(skillsData.skills.map((s: any) => ({
            ...s,
            recordId: skillsData.recordId
          })));
          
          toast.success(`Loaded ${skillsData.skills.length} skills successfully!`);
          
          // No need to fetch from API since we have the data
          return;
        }
        
        // Fallback to recordId extraction if skills data is not found
        const recordIdPatterns = [
          /recordId[:=\s]*["']?([a-zA-Z0-9-]+)["']?/i,
          /with recordId[:=\s]*["']?([a-zA-Z0-9-]+)["']?/i,
          /with record ?id[:=\s]*["']?([a-zA-Z0-9-]+)["']?/i,
          /saved.*?with recordId[:=\s]*["']?([a-zA-Z0-9-]+)["']?/i,
          /saved.*?information with recordId[:=\s]*["']?([a-zA-Z0-9-]+)["']?/i
        ];
        
        let match = null;
        for (const pattern of recordIdPatterns) {
          match = message.content.match(pattern);
          if (match && match[1]) {
            console.log("Found recordId:", match[1]);
            setRecordId(match[1]);
            
            // Fetch skills data from API
            fetchRecordData(match[1]);
            break;
          }
        }
        
        if (match) break;
      }
    }
  }, [localMessages, messages]);

  // Sync localMessages with messages from useChat hook
  useEffect(() => {
    if (messages.length > 0) {
      setLocalMessages(messages);
    }
  }, [messages]);

  // Add welcome message when component mounts
  useEffect(() => {
    if (localMessages.length === 0) {
      // Add initial welcome message
      setLocalMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Welcome to the Job Description Analyzer! Please share your job description, and I'll help you extract key skills and generate relevant interview questions."
      }]);
    }
  }, []);

  // Handle question status change (liked/disliked)
  const handleQuestionStatusChange = async (
    questionId: string, 
    status: "LIKED" | "DISLIKED" | "NONE"
  ) => {
    // Update locally first
    setQuestions((prevQuestions) =>
      prevQuestions.map((q) =>
        q.id === questionId ? { ...q, liked: status } : q
      )
    );

    // Update in database
    try {
      const response = await fetch(`/api/questions/${questionId}/like`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update question status");
      }
    } catch (error) {
      console.error("Error updating question status:", error);
      toast.error("Failed to update question status");
      // Revert the change in case of error
      fetchLatestQuestions();
    }
  };

  // Handle question feedback
  const handleQuestionFeedbackChange = async (
    questionId: string,
    feedback: string
  ) => {
    // Update locally first
    setQuestions((prevQuestions) =>
      prevQuestions.map((q) => (q.id === questionId ? { ...q, feedback } : q))
    );

    // Update in database
    try {
      const response = await fetch(`/api/questions/${questionId}/feedback`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ feedback }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update question feedback");
      }
    } catch (error) {
      console.error("Error updating question feedback:", error);
      toast.error("Failed to update question feedback");
      fetchLatestQuestions();
    }
  };

  // Fetch latest questions
  const fetchLatestQuestions = async () => {
    if (!recordId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/records/${recordId}/questions`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }
      
      const data = await response.json();
      if (data.success) {
        setQuestions(formatQuestions(data.questions));
      }
    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Regenerate a question
  const handleRegenerateQuestion = async (questionId: string) => {
    if (!questionId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/questions/${questionId}/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to regenerate question");
      }

      const data = await response.json();

      if (data.success) {
        // Parse the new content
        const newContent =
          typeof data.question.content === "string"
            ? JSON.parse(data.question.content)
            : data.question.content;

        // Update the questions list with the new question
        setQuestions((prevQuestions) =>
          prevQuestions.map((q) =>
            q.id === questionId
              ? {
                  ...q,
                  question: newContent.question,
                  answer: newContent.answer,
                  category: newContent.category,
                  difficulty: newContent.difficulty,
                  liked: "NONE",
                  feedback: "",
                }
              : q
          )
        );

        toast.success("Question regenerated successfully");

        // Refresh the questions data
        fetchLatestQuestions();
      }
    } catch (error) {
      console.error("Error regenerating question:", error);
      toast.error("Failed to regenerate question");
    } finally {
      setLoading(false);
    }
  };

  // Helper functions from SkillRecordEditor
  const getSkillName = (skillId: string) => {
    const skill = skills.find((s) => s.id === skillId);
    return skill ? skill.name : "Unknown Skill";
  };

  const getDifficultyClass = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy":
        return "bg-green-50 text-green-800 border-green-200";
      case "medium":
        return "bg-orange-50 text-orange-800 border-orange-200";
      case "hard":
        return "bg-red-50 text-red-800 border-red-200";
      default:
        return "bg-orange-50 text-orange-800 border-orange-200";
    }
  };

  const getCategoryClass = (category: string) => {
    switch (category.toLowerCase()) {
      case "technical":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "experience":
        return "bg-purple-50 text-purple-800 border-purple-200";
      case "problem solving":
        return "bg-indigo-50 text-indigo-800 border-indigo-200";
      case "soft skills":
        return "bg-pink-50 text-pink-800 border-pink-200";
      default:
        return "bg-gray-50 text-gray-800 border-gray-200";
    }
  };

  const getQuestionFormatClass = (format: string) => {
    switch (format.toLowerCase()) {
      case "open-ended":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "coding":
        return "bg-violet-50 text-violet-800 border-violet-200";
      case "scenario":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "case study":
        return "bg-cyan-50 text-cyan-800 border-cyan-200";
      case "design":
        return "bg-rose-50 text-rose-800 border-rose-200";
      case "live assessment":
        return "bg-teal-50 text-teal-800 border-teal-200";
      default:
        return "bg-amber-50 text-amber-800 border-amber-200";
    }
  };

  // Sort questions by skillId then by difficulty
  const sortedQuestions = [...questions].sort((a, b) => {
    // First sort by skillId
    if (a.skillId !== b.skillId) {
      return a.skillId.localeCompare(b.skillId);
    }

    // Then by difficulty (Hard, Medium, Easy)
    const difficultyOrder = { Hard: 0, Medium: 1, Easy: 2 };
    const aDiffValue = difficultyOrder[a.difficulty as keyof typeof difficultyOrder] ?? 1;
    const bDiffValue = difficultyOrder[b.difficulty as keyof typeof difficultyOrder] ?? 1;
    return aDiffValue - bDiffValue;
  });

  // Track the current skill to know when to add a divider
  let currentSkillId = "";

  // Manual submit function for testing
  const handleManualSubmit = async () => {
    if (!input.trim()) {
      toast.error("Please enter a message first");
      return;
    }
    
    try {
      const response = await fetch('/api/chat-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: input }]
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Manual API response:", data);
      toast.success("Message sent successfully!");
      
      // Clear input
      handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
    } catch (error) {
      console.error("Manual submit error:", error);
      toast.error("Failed to send message");
    }
  };

  // Handle user message based on current conversation stage
  const handleUserMessage = (message: string) => {
    switch (conversationState.stage) {
      case 'initial':
        // User provided job description
        setConversationState({
          ...conversationState,
          stage: 'jd_provided',
          jobDescription: message,
        });
        return 'Would you like to use Learning Mode to leverage past interview questions? (yes/no)';
        
      case 'jd_provided':
        // User answered about learning mode
        const useLearningMode = message.toLowerCase().includes('yes');
        setConversationState({
          ...conversationState,
          stage: 'learning_mode',
          useLearningMode,
        });
        return 'Please specify the interview length in minutes (e.g., 60):';
        
      case 'learning_mode':
        // User specified interview length
        const interviewLength = parseInt(message) || 60;
        setConversationState({
          ...conversationState,
          stage: 'interview_length',
          interviewLength,
        });
        return 'Please provide any custom instructions or preferences (or type "none" if none):';
        
      case 'interview_length':
        // User provided custom instructions
        setConversationState({
          ...conversationState,
          stage: 'custom_instructions',
          customInstructions: message === 'none' ? '' : message,
        });
        return 'Would you like to: \n1. Extract skills only\n2. Auto-generate skills and questions';
        
      case 'custom_instructions':
        // User selected option
        const option = message.includes('1') ? 'extract' : 'auto';
        
        // Process based on selected option
        if (option === 'extract') {
          extractSkills(
            conversationState.jobDescription,
            conversationState.useLearningMode
          );
        } else {
          autoGenerateSkillsAndQuestions(
            conversationState.jobDescription,
            conversationState.useLearningMode,
            conversationState.interviewLength,
            conversationState.customInstructions
          );
        }
        
        setConversationState({
          ...conversationState,
          stage: 'processing',
        });
        
        return "Processing your request...";
        
      default:
        return null;
    }
  };

  // Function to extract skills from job description
  const extractSkills = async (jobDescription: string, useLearningMode: boolean) => {
    setLoading(true);
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: localMessages,
          operation: "extract-skills",
          params: {
            jobDescription,
            useLearningMode,
            interviewLength: conversationState.interviewLength,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to extract skills");
      }
      
      const data = await response.json();
      
      // Add the response to the chat
      if (Array.isArray(data) && data.length > 0 && data[0].role === 'assistant') {
        setLocalMessages((prev) => [...prev, data[0]]);
      } else {
        throw new Error("Unexpected response format");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error extracting skills:", error);
      toast.error("Error extracting skills. Please try again.");
      setLoading(false);
      
      // Add error message to chat
      setLocalMessages((prev) => [
        ...prev, 
        { 
          id: Date.now().toString(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error while extracting skills. Please try again."
        }
      ]);
    }
  };
  
  // Function to auto-generate skills and questions
  const autoGenerateSkillsAndQuestions = async (
    jobDescription: string,
    useLearningMode: boolean,
    interviewLength: number,
    customInstructions: string
  ) => {
    setLoading(true);
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: localMessages,
          operation: "auto-generate",
          params: {
            jobTitle: "Extracted from JD",
            jobDescription,
            interviewLength,
            customInstructions,
            useLearningMode,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to auto-generate skills and questions");
      }
      
      const data = await response.json();
      
      // Add the response to the chat
      if (Array.isArray(data) && data.length > 0 && data[0].role === 'assistant') {
        setLocalMessages((prev) => [...prev, data[0]]);
      } else {
        throw new Error("Unexpected response format");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error auto-generating:", error);
      toast.error("Error generating skills and questions. Please try again.");
      setLoading(false);
      
      // Add error message to chat
      setLocalMessages((prev) => [
        ...prev, 
        { 
          id: Date.now().toString(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error while generating skills and questions. Please try again."
        }
      ]);
    }
  };

  // Custom chat submission function that handles sending messages without streaming
  const customHandleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!input.trim()) {
      toast.error("Please enter a message first");
      return;
    }
    
    try {
      // Add user message locally
      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: input,
      };
      
      setLocalMessages((prev) => [...prev, userMessage]);
      
      // Clear input
      handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
      
      // Show loading state
      setLocalLoading(true);
      
      // Check if we need to handle message based on conversation state
      const conversationalResponse = handleUserMessage(userMessage.content);
      
      if (conversationalResponse) {
        // Add assistant response for structured conversation
        setTimeout(() => {
          setLocalMessages((prev) => [
            ...prev, 
            { 
              id: Date.now().toString(),
              role: 'assistant',
              content: conversationalResponse
            }
          ]);
          setLocalLoading(false);
        }, 1000); // Slight delay for natural feel
        return;
      }
      
      // If not part of structured conversation, process normally
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...localMessages],
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("API Response:", data);
      
      // Add assistant message if returned correctly
      if (Array.isArray(data) && data.length > 0 && data[0].role === 'assistant') {
        setLocalMessages((prev) => [...prev, data[0]]);
      } else if (data.role === 'assistant') {
        setLocalMessages((prev) => [...prev, data]);
      } else {
        console.error("Unexpected API response format:", data);
        toast.error("Received an invalid response format");
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setLocalLoading(false);
    }
  };

  // Render the content of a message, possibly with a table for skills
  const renderMessageContent = (content: string) => {
    if (!content) return null;
    
    // Check if this message contains skills data
    const skillsData = extractSkillsData(content);
    // Check if this message contains questions data
    const questionsData = extractQuestionsData(content);
    
    // If no structured data, just render the content normally
    if (!skillsData && !questionsData) {
      return <div className="whitespace-pre-line">{content}</div>;
    }
    
    // Clean content by removing data tags
    let cleanContent = content
      .replace(/<skills-data>.*?<\/skills-data>/gmi, '')
      .replace(/<questions-data>.*?<\/questions-data>/gmi, '');
    
    return (
      <>
        <div className="whitespace-pre-line mb-4">{cleanContent}</div>
        
        {/* Render skills table if available */}
        {skillsData && skillsData.skills && skillsData.skills.length > 0 && (
          <div className="border rounded-md overflow-hidden mt-2 bg-white shadow">
            <div className="bg-primary/10 px-3 py-2 text-sm font-medium border-b">
              Skills Identified ({skillsData.skills.length})
            </div>
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-primary/5">
                    <TableHead className="w-[40%] py-2">Skill</TableHead>
                    <TableHead className="w-[20%] py-2">Level</TableHead>
                    <TableHead className="w-[20%] py-2">Required</TableHead>
                    <TableHead className="w-[20%] py-2">Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skillsData.skills.map((skill: any) => (
                    <TableRow key={skill.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium py-2">{skill.name}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className={
                          skill.level === "EXPERT" ? "bg-purple-50 text-purple-800 border-purple-200" :
                          skill.level === "PROFESSIONAL" ? "bg-blue-50 text-blue-800 border-blue-200" :
                          skill.level === "INTERMEDIATE" ? "bg-green-50 text-green-800 border-green-200" :
                          "bg-gray-50 text-gray-800 border-gray-200"
                        }>
                          {skill.level.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={skill.requirement === "MANDATORY" ? "default" : "outline"}>
                          {skill.requirement === "MANDATORY" ? "Required" : "Optional"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className={
                          skill.category === "TECHNICAL" ? "bg-blue-50 text-blue-800 border-blue-200" :
                          skill.category === "FUNCTIONAL" ? "bg-green-50 text-green-800 border-green-200" :
                          skill.category === "BEHAVIORAL" ? "bg-purple-50 text-purple-800 border-purple-200" :
                          skill.category === "COGNITIVE" ? "bg-amber-50 text-amber-800 border-amber-200" :
                          ""
                        }>
                          {skill.category?.toLowerCase() || "Not specified"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        
        {/* Render questions table if available */}
        {questionsData && questionsData.questions && questionsData.questions.length > 0 && (
          renderQuestionsTable(questionsData.questions)
        )}
      </>
    );
  };

  // Improve the debug UI to show raw JSON
  const renderDebugSection = () => {
    if (!debugMode) return null;
    
    // Find the first assistant message with skills data
    const assistantMessage = localMessages.find(
      m => m.role === 'assistant' && m.content?.includes('<skills-data>')
    );
    
    const skillsData = assistantMessage ? extractSkillsData(assistantMessage.content) : null;
    
    return (
      <div className="mt-4 border p-2 rounded bg-slate-50">
        <div className="text-sm font-semibold mb-1">Debug: Skills JSON</div>
        <pre className="text-xs overflow-auto max-h-[150px]">
          {skillsData ? JSON.stringify(skillsData, null, 2) : "No skills data found"}
        </pre>
      </div>
    );
  };

  // Function to render questions table
  const renderQuestionsTable = (questions: any[]) => {
    if (!questions || questions.length === 0) return null;
    
    return (
      <div className="border rounded-md overflow-hidden mt-4 mb-4 bg-white shadow">
        <div className="bg-primary/10 px-3 py-2 text-sm font-medium border-b">
          Interview Questions ({questions.length})
        </div>
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-primary/5">
                <TableHead className="w-[15%] py-2">Skill</TableHead>
                <TableHead className="w-[35%] py-2">Question</TableHead>
                <TableHead className="w-[35%] py-2">Expected Answer</TableHead>
                <TableHead className="w-[15%] py-2">Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((question: any, index: number) => {
                const questionData = typeof question.content === 'string' 
                  ? JSON.parse(question.content) 
                  : question.content;
                  
                return (
                  <TableRow key={question.id || index} className="hover:bg-muted/50">
                    <TableCell className="font-medium py-2">
                      {question.skillName || "General"}
                    </TableCell>
                    <TableCell className="py-2">
                      {questionData.question}
                    </TableCell>
                    <TableCell className="py-2 text-sm">
                      <div className="max-h-[100px] overflow-auto">
                        {questionData.answer}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className={
                        questionData.category === "Technical" ? "bg-blue-50 text-blue-800 border-blue-200" :
                        questionData.category === "Experience" ? "bg-green-50 text-green-800 border-green-200" :
                        questionData.category === "Problem Solving" ? "bg-purple-50 text-purple-800 border-purple-200" :
                        questionData.category === "Soft Skills" ? "bg-amber-50 text-amber-800 border-amber-200" :
                        ""
                      }>
                        {questionData.category || "General"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto max-w-7xl">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Job Description QnA</CardTitle>
          <CardDescription>
            Chat with AI about your job description to create interview questions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-[600px] overflow-y-auto border rounded-md p-4 mb-4">
            {localMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Start a conversation by entering your job description
              </div>
            ) : (
              localMessages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "mb-6 flex",
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      message.role === "user"
                        ? "rounded-lg px-4 py-2 max-w-[85%] bg-primary text-primary-foreground"
                        : extractSkillsData(message.content || "") 
                          ? "rounded-lg px-4 py-4 max-w-[90%] bg-muted w-[90%]"
                          : "rounded-lg px-4 py-2 max-w-[85%] bg-muted"
                    )}
                  >
                    {message.role === "user" ? 
                      <div className="whitespace-pre-line">{message.content}</div> : 
                      renderMessageContent(message.content || "")}
                  </div>
                </div>
              ))
            )}
            {(localLoading || isLoading) && (
              <div className="flex justify-start mb-4">
                <div className="rounded-lg px-4 py-2 max-w-[80%] bg-muted">
                  <Spinner size="sm" className="mr-2" />
                  Thinking...
                </div>
              </div>
            )}
          </div>
          
          {/* Debug mode toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox" 
                id="debug-mode"
                checked={debugMode}
                onChange={() => setDebugMode(!debugMode)}
              />
              <label htmlFor="debug-mode" className="text-sm text-muted-foreground">
                Debug Mode ({debugMode ? "Test API" : "Real API"})
              </label>
            </div>
            
            {debugMode && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleManualSubmit}
                disabled={!input.trim() || isLoading || localLoading}
              >
                Test Send
              </Button>
            )}
          </div>
          
          {/* Debug info panel */}
          {debugMode && renderDebugSection()}
        </CardContent>
        <CardFooter>
          <form onSubmit={customHandleSubmit} className="flex w-full gap-2">
            <Input
              placeholder="Type your job description or question here..."
              value={input}
              onChange={handleInputChange}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || localLoading || !input.trim()}>
              Send
            </Button>
          </form>
        </CardFooter>
      </Card>

      {/* Skills card is now displayed directly within the chat messages rather than as a separate component */}

      {recordId && questions.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Interview Questions</CardTitle>
                <CardDescription>Generated questions for the skills</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchLatestQuestions}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border relative overflow-x-auto">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[12%]">Skill</TableHead>
                    <TableHead className="w-[10%]">Category</TableHead>
                    <TableHead className="w-[12%]">Format</TableHead>
                    <TableHead className="w-[46%]">Question</TableHead>
                    <TableHead className="w-[20%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedQuestions.map((question, index) => {
                    // Check if this is a new skill group
                    const isNewSkillGroup = question.skillId !== currentSkillId;
                    // Update current skill
                    currentSkillId = question.skillId;

                    return (
                      <>
                        {isNewSkillGroup && (
                          <TableRow key={`header-${question.skillId}`} className="bg-muted/30">
                            <TableCell colSpan={5} className="py-2">
                              <span className="font-semibold">{getSkillName(question.skillId)}</span>
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow 
                          key={question.id}
                          className={cn(
                            "cursor-pointer hover:bg-muted/50",
                            question.liked === "LIKED" && "bg-green-50",
                            question.liked === "DISLIKED" && "bg-red-50"
                          )}
                        >
                          <TableCell>
                            <div className="pl-4">
                              <span className="text-sm text-muted-foreground">
                                Question {index + 1}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getCategoryClass(
                                question.category
                              )}`}
                            >
                              {question.category}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getQuestionFormatClass(
                                question.questionFormat || "Scenario"
                              )}`}
                            >
                              {question.questionFormat || "Scenario"}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="whitespace-normal break-words">
                              <QuestionDialog
                                questionId={question.id}
                                question={question.question}
                                answer={question.answer}
                                category={question.category}
                                difficulty={question.difficulty}
                                questionFormat={question.questionFormat}
                                liked={question.liked}
                                feedback={question.feedback}
                                onStatusChange={(status) =>
                                  handleQuestionStatusChange(question.id, status)
                                }
                                onFeedbackChange={(feedback) =>
                                  handleQuestionFeedbackChange(question.id, feedback)
                                }
                                onRegenerateQuestion={handleRegenerateQuestion}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleQuestionStatusChange(question.id, "LIKED")}
                                className={cn(
                                  "h-8 w-8",
                                  question.liked === "LIKED" && "bg-green-100 text-green-800"
                                )}
                              >
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <ThumbsUp className="h-4 w-4" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Mark as helpful
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleQuestionStatusChange(question.id, "DISLIKED")}
                                className={cn(
                                  "h-8 w-8",
                                  question.liked === "DISLIKED" && "bg-red-100 text-red-800"
                                )}
                              >
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <ThumbsDown className="h-4 w-4" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Mark as not helpful
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRegenerateQuestion(question.id)}
                                disabled={loading}
                              >
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Regenerate question
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
