"use client";

import { useState, useEffect, useRef } from "react";
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

// Define a PromptCard component for interactive options
interface PromptCardProps {
  text: string;
  onClick: () => void;
  selected?: boolean;
  className?: string;
}

const PromptCard = ({ text, onClick, selected, className }: PromptCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-4 rounded-2xl border text-left transition-all duration-200 ease-in-out ",
        "focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2",
        selected
          ? "bg-blue-100 border-blue-400 shadow-md"
          : "bg-gray-200 hover:bg-gray-50 border-gray-300 hover:shadow-sm",
        className
      )}
    >
      <span className="text-sm text-gray-800 font-medium leading-relaxed">
        {text}
      </span>
    </button>
  );
};

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

  // Create a ref for the chat messages container
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Local state for managing messages and loading state
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [localLoading, setLocalLoading] = useState(false);

  // Define conversation state management
  const [conversationState, setConversationState] = useState({
    stage: 'initial', // initial, jd_provided, learning_mode, interview_length, custom_instructions, options, processing, skills_extracted, auto_generated, edit_skill
    jobDescription: '',
    useLearningMode: false,
    interviewLength: 60,
    customInstructions: '',
    skillToEdit: '',
  });

  // Add state to manage UI prompts
  const [showJobDescriptionCard, setShowJobDescriptionCard] = useState(false);
  const [jobDescriptionText, setJobDescriptionText] = useState("");

  // Add new state variable to track input placeholder
  const [inputPlaceholder, setInputPlaceholder] = useState("Type your job description or question here...");

  // Add new state variables to track specific loading operations
  const [regeneratingSkills, setRegeneratingSkills] = useState(false);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [regeneratingWithInstructions, setRegeneratingWithInstructions] = useState(false);

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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [localMessages]);

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

  // Update the input placeholder in the return statement
  const handleUserMessage = (message: string) => {
    switch (conversationState.stage) {
      case 'initial':
        // User provided job description
        setConversationState({
          ...conversationState,
          stage: 'jd_provided',
          jobDescription: message,
        });
        // Reset placeholder text
        setInputPlaceholder("Type your response here...");
        return 'Would you like to use Learning Mode to leverage past interview questions?';
        
      case 'jd_provided':
        // User answered about learning mode
        const useLearningMode = message.toLowerCase().includes('yes');
        setConversationState({
          ...conversationState,
          stage: 'learning_mode',
          useLearningMode,
        });
        return 'Please specify the interview length in minutes:';
        
      case 'learning_mode':
        // User specified interview length
        const interviewLength = parseInt(message) || 60;
        setConversationState({
          ...conversationState,
          stage: 'interview_length',
          interviewLength,
        });
        return 'Please provide any custom instructions or preferences:';
        
      case 'interview_length':
        // User provided custom instructions
        setConversationState({
          ...conversationState,
          stage: 'custom_instructions',
          customInstructions: message === 'none' ? '' : message,
        });
        return 'Would you like to extract skills only or auto-generate skills and questions?';
        
      case 'custom_instructions':
        // User selected option
        const option = message.includes('extract') ? 'extract' : 'auto';
        
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
        
        setInputPlaceholder("Type your message here...");
        return "Processing your request...";
        
      case 'awaiting_custom_instructions_skills':
        // User provided custom instructions for skills regeneration
        applyCustomInstructions(message);
        setConversationState({
          ...conversationState,
          stage: 'processing',
        });
        setInputPlaceholder("Type your message here...");
        return `Processing your request with custom instructions: "${message}"...`;
        
      case 'awaiting_custom_instructions_auto':
        // User provided custom instructions for auto regeneration
        applyCustomInstructions(message);
        setConversationState({
          ...conversationState,
          stage: 'processing',
        });
        setInputPlaceholder("Type your message here...");
        return `Processing your request with custom instructions: "${message}"...`;

      case 'edit_skill':
        // User specified the skill to edit
        setConversationState({
          ...conversationState,
          skillToEdit: message,
          stage: 'processing_edit'
        });

        // Call API to edit skill
        editSkill(message);
        setInputPlaceholder("Type your message here...");
        return `I'll help you edit the skill: ${message}. Processing your request...`;

      case 'edit_question':
        // User specified the question to edit
        setConversationState({
          ...conversationState,
          stage: 'processing_edit'
        });

        // Call API to edit question
        editQuestion(message);
        setInputPlaceholder("Type your message here...");
        return `I'll help you edit the question about ${message}. Processing your request...`;
        
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
      // Check if this is a job description upload (longer text)
      if (input.length > 500 && conversationState.stage === 'initial') {
        // Store job description in state
        setJobDescriptionText(input);
        
        // Add as a regular user message with metadata to identify it as a JD
        const jdMessage = {
          id: Date.now().toString(),
          role: 'user' as const,
          content: input,
          isJobDescription: true, // Add metadata to identify as job description
        };
        
        setLocalMessages((prev) => [...prev, jdMessage]);
        
        // Clear input
        handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
        
        // Update conversation state
        setConversationState({
          ...conversationState,
          stage: 'jd_provided',
          jobDescription: input,
        });
        
        // Add assistant response after a short delay
        setTimeout(() => {
          setLocalMessages((prev) => [
            ...prev, 
            { 
              id: Date.now().toString(),
              role: 'assistant',
              content: 'Would you like to use Learning Mode to leverage past interview questions?'
            }
          ]);
        }, 1000);
        
        return;
      } else {
        // Add user message locally
        const userMessage = {
          id: Date.now().toString(),
          role: 'user' as const,
          content: input,
        };
        
        setLocalMessages((prev) => [...prev, userMessage]);
      }
      
      // Clear input
      handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
      
      // Show loading state
      setLocalLoading(true);
      
      // Check if we need to handle message based on conversation state
      const conversationalResponse = handleUserMessage(input);
      
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

  // Handle job description submission from card - keeping for reference
  const handleJobDescriptionSubmit = () => {
    // Update conversation state with the job description
    setConversationState({
      ...conversationState,
      stage: 'jd_provided',
      jobDescription: jobDescriptionText,
    });
    
    // Add assistant response for the next step
    setTimeout(() => {
      setLocalMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Would you like to use Learning Mode to leverage past interview questions?'
        }
      ]);
      // Don't hide the job description card
      // setShowJobDescriptionCard(false);
    }, 500);
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
      // Check if this is a response to an edit operation
      if (conversationState.stage === 'processing_edit' && 
          (content.includes("I've updated the skill") || 
           content.includes("I've updated the question"))) {
        
        // Determine if we should go back to skills_extracted or auto_generated state
        if (content.includes("I've updated the skill")) {
          setConversationState({
            ...conversationState,
            stage: 'skills_extracted'
          });
        } else if (content.includes("I've updated the question")) {
          setConversationState({
            ...conversationState,
            stage: 'auto_generated'
          });
        }
      }
      
      return <div className="whitespace-pre-line">{content}</div>;
    }
    
    // Clean content by removing data tags
    let cleanContent = content
      .replace(/<skills-data>.*?<\/skills-data>/gmi, '')
      .replace(/<questions-data>.*?<\/questions-data>/gmi, '');

    // Update conversation state if skills or questions were extracted
    if (skillsData && (conversationState.stage === 'processing' || conversationState.stage === 'processing_edit')) {
      setConversationState({
        ...conversationState,
        stage: 'skills_extracted'
      });
    }

    if (questionsData && (conversationState.stage === 'processing' || conversationState.stage === 'processing_edit')) {
      setConversationState({
        ...conversationState,
        stage: 'auto_generated'
      });
    }
    
    return (
      <>
        <div className="whitespace-pre-line mb-4">{cleanContent}</div>
        
        {/* Render skills table if available */}
        {skillsData && skillsData.skills && skillsData.skills.length > 0 && renderSkillsTable(skillsData)}
        
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
      <div className="mt-4 border border-gray-100 p-3 rounded-xl bg-gray-50/50 backdrop-blur-sm">
        <div className="text-sm font-medium text-gray-700 mb-2">Debug: Skills JSON</div>
        <pre className="text-xs overflow-auto max-h-[150px] bg-white p-3 rounded-lg border border-gray-100">
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
                // Add null checking and default values
                let questionData;
                try {
                  questionData = typeof question.content === 'string' 
                    ? JSON.parse(question.content) 
                    : question.content || {};
                } catch (e) {
                  console.error("Error parsing question content:", e);
                  questionData = { 
                    question: "Error loading question", 
                    answer: "Error loading answer", 
                    category: "General" 
                  };
                }
                
                // Make sure questionData.question exists
                const questionText = questionData?.question || "Question not available";
                  
                return (
                  <TableRow 
                    key={question.id || index} 
                    className={cn(
                      "hover:bg-muted/50",
                      conversationState.stage === 'edit_question' && "cursor-pointer hover:bg-blue-50"
                    )}
                    onClick={() => handleQuestionClick(questionText)}
                  >
                    <TableCell className="font-medium py-2">
                      {question.skillName || "General"}
                    </TableCell>
                    <TableCell className="py-2">
                      {questionText}
                      {conversationState.stage === 'edit_question' && (
                        <span className="ml-2 text-xs text-blue-500">(click to edit)</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-sm">
                      <div className="max-h-[100px] overflow-auto">
                        {questionData?.answer || "Answer not available"}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className={
                        questionData?.category === "Technical" ? "bg-blue-50 text-blue-800 border-blue-200" :
                        questionData?.category === "Experience" ? "bg-green-50 text-green-800 border-green-200" :
                        questionData?.category === "Problem Solving" ? "bg-purple-50 text-purple-800 border-purple-200" :
                        questionData?.category === "Soft Skills" ? "bg-amber-50 text-amber-800 border-amber-200" :
                        ""
                      }>
                        {questionData?.category || "General"}
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

  // Function to handle prompt card selections
  const handlePromptCardSelection = (option: string) => {
    // Create a simulated user message
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const, 
      content: option
    };
    
    // Add to the message history
    setLocalMessages(prev => [...prev, userMessage]);
    
    // Use the existing logic to handle the user's message
    const assistantResponse = handleUserMessage(option);
    
    if (assistantResponse) {
      setTimeout(() => {
        setLocalMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: assistantResponse
          }
        ]);
      }, 500);
    }
  };

  // Render interactive prompt options based on conversation stage
  const renderPromptOptions = () => {
    const lastAssistantMessage = [...localMessages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMessage) return null;
    
    // Check if the last message contains edit confirmation
    if (lastAssistantMessage.content.includes("I've updated the skill")) {
      // Show skills extracted prompt cards again
      return (
        <div className="flex flex-wrap gap-2 mt-4 justify-center py-2">
          <PromptCard 
            text="Edit a skill" 
            onClick={handleEditSkill} 
          />
          <PromptCard 
            text={regeneratingSkills ? "Regenerating skills..." : "Regenerate all skills"}
            onClick={regenerateSkills}
            className={regeneratingSkills ? "opacity-70 cursor-not-allowed" : ""}
          />
          {/* <PromptCard 
            text={regeneratingWithInstructions ? "Applying instructions..." : "Add custom instructions"}
            onClick={() => {
              if (regeneratingWithInstructions) return;
              
              // Update stage to show we're waiting for custom instructions
              setConversationState({
                ...conversationState,
                stage: 'awaiting_custom_instructions_skills'
              });
              
              // Update placeholder text
              setInputPlaceholder("Enter custom instructions (e.g., 'Generate more technical skills')...");
              
              // Add a message prompting for instructions
              setLocalMessages(prev => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: "Please enter your custom instructions for regenerating skills:"
                }
              ]);
            }}
            className={regeneratingWithInstructions ? "opacity-70 cursor-not-allowed" : ""}
          /> */}
          <PromptCard 
            text="Restart" 
            onClick={restartConversation}
          />
        </div>
      );
    }
    
    // Check if the last message contains question edit confirmation
    if (lastAssistantMessage.content.includes("I've updated the question")) {
      // Show auto generated prompt cards again
      return (
        <div className="flex flex-wrap gap-2 mt-4 justify-center py-2">
          <PromptCard 
            text="Edit a skill" 
            onClick={handleEditSkill} 
          />
          {/* <PromptCard 
            text="Edit a question" 
            onClick={handleEditQuestion}
          /> */}
          <PromptCard 
            text={regeneratingAll ? "Regenerating all..." : "Regenerate all"}
            onClick={regenerateAll}
            className={regeneratingAll ? "opacity-70 cursor-not-allowed" : ""}
          />
          {/* <PromptCard 
            text={regeneratingWithInstructions ? "Applying instructions..." : "Add custom instructions"}
            onClick={() => {
              if (regeneratingWithInstructions) return;
              
              // Update stage to show we're waiting for custom instructions
              setConversationState({
                ...conversationState,
                stage: 'awaiting_custom_instructions_auto'
              });
              
              // Update placeholder text
              setInputPlaceholder("Enter custom instructions (e.g., 'Generate more technical questions')...");
              
              // Add a message prompting for instructions
              setLocalMessages(prev => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: "Please enter your custom instructions for regenerating skills and questions:"
                }
              ]);
            }}
            className={regeneratingWithInstructions ? "opacity-70 cursor-not-allowed" : ""}
          /> */}
          <PromptCard 
            text="Restart" 
            onClick={restartConversation}
          />
        </div>
      );
    }
    
    if (lastAssistantMessage.content.includes('Would you like to use Learning Mode')) {
      return (
        <div className="flex flex-wrap gap-2 mt-2 justify-center py-2">
          <PromptCard 
            text="Yes, use Learning Mode" 
            onClick={() => handlePromptCardSelection("yes")}
          />
          <PromptCard 
            text="No, don't use Learning Mode" 
            onClick={() => handlePromptCardSelection("no")}
          />
        </div>
      );
    }
    
    if (lastAssistantMessage.content.includes('Please specify the interview length')) {
      return (
        <div className="flex flex-wrap gap-2 mt-2 justify-center py-2">
          <PromptCard 
            text="15 minutes" 
            onClick={() => handlePromptCardSelection("15")}
          />
          <PromptCard 
            text="30 minutes" 
            onClick={() => handlePromptCardSelection("30")}
          />
          <PromptCard 
            text="45 minutes" 
            onClick={() => handlePromptCardSelection("45")}
          />
          <PromptCard 
            text="60 minutes" 
            onClick={() => handlePromptCardSelection("60")}
          />
        </div>
      );
    }
    
    if (lastAssistantMessage.content.includes('Please provide any custom instructions')) {
      return (
        <div className="flex flex-wrap gap-2 mt-2 justify-center py-2">
          <PromptCard 
            text="None" 
            onClick={() => handlePromptCardSelection("none")}
          />
        </div>
      );
    }
    
    if (lastAssistantMessage.content.includes('extract skills only or auto-generate')) {
      return (
        <div className="flex flex-wrap gap-2 mt-2 justify-center py-2">
          <PromptCard 
            text="Extract skills only" 
            onClick={() => handlePromptCardSelection("extract")}
          />
          <PromptCard 
            text="Auto-generate skills and questions" 
            onClick={() => handlePromptCardSelection("auto")}
          />
        </div>
      );
    }
    
    // Modify prompt options for 'skills_extracted'
    if (conversationState.stage === 'skills_extracted') {
      return (
        <div className="flex flex-wrap gap-2 mt-4 justify-center py-2">
          <PromptCard 
            text="Edit a skill" 
            onClick={handleEditSkill} 
          />
          <PromptCard 
            text={regeneratingSkills ? "Regenerating skills..." : "Regenerate all skills"}
            onClick={regenerateSkills}
            className={regeneratingSkills ? "opacity-70 cursor-not-allowed" : ""}
          />
          <PromptCard 
            text={regeneratingWithInstructions ? "Applying instructions..." : "Add custom instructions"}
            onClick={() => {
              if (regeneratingWithInstructions) return;
              
              // Update stage to show we're waiting for custom instructions
              setConversationState({
                ...conversationState,
                stage: 'awaiting_custom_instructions_skills'
              });
              
              // Update placeholder text
              setInputPlaceholder("Enter custom instructions (e.g., 'Generate more technical skills')...");
              
              // Add a message prompting for instructions
              setLocalMessages(prev => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: "Please enter your custom instructions for regenerating skills:"
                }
              ]);
            }}
            className={regeneratingWithInstructions ? "opacity-70 cursor-not-allowed" : ""}
          />
          <PromptCard 
            text="Restart" 
            onClick={restartConversation}
          />
        </div>
      );
    }
    
    // Modify prompt options for 'auto_generated'
    if (conversationState.stage === 'auto_generated') {
      return (
        <div className="flex flex-wrap gap-2 mt-4 justify-center py-2">
          <PromptCard 
            text="Edit a skill" 
            onClick={handleEditSkill} 
          />
          <PromptCard 
            text="Edit a question" 
            onClick={handleEditQuestion}
          />
          <PromptCard 
            text={regeneratingAll ? "Regenerating all..." : "Regenerate all"}
            onClick={regenerateAll}
            className={regeneratingAll ? "opacity-70 cursor-not-allowed" : ""}
          />
          <PromptCard 
            text={regeneratingWithInstructions ? "Applying instructions..." : "Add custom instructions"}
            onClick={() => {
              if (regeneratingWithInstructions) return;
              
              // Update stage to show we're waiting for custom instructions
              setConversationState({
                ...conversationState,
                stage: 'awaiting_custom_instructions_auto'
              });
              
              // Update placeholder text
              setInputPlaceholder("Enter custom instructions (e.g., 'Generate more technical questions')...");
              
              // Add a message prompting for instructions
              setLocalMessages(prev => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: "Please enter your custom instructions for regenerating skills and questions:"
                }
              ]);
            }}
            className={regeneratingWithInstructions ? "opacity-70 cursor-not-allowed" : ""}
          />
          <PromptCard 
            text="Restart" 
            onClick={restartConversation}
          />
        </div>
      );
    }
    
    return null;
  };

  // Handle skill editing - restore original function that prompts for input
  const handleEditSkill = async () => {
    setConversationState({
      ...conversationState,
      stage: 'edit_skill'
    });
    
    // Add a message to prompt the user
    setLocalMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Please specify which skill you want to edit (You can click on the skill in the table to edit it):'
      }
    ]);
    
    // Update placeholder
    setInputPlaceholder("Type the skill name you want to edit...");
  };

  // Handle question editing - restore original function that prompts for input
  const handleEditQuestion = async () => {
    setConversationState({
      ...conversationState,
      stage: 'edit_question'
    });
    
    // Add a message to prompt the user
    setLocalMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Please specify which question you want to edit (You can click on the question in the table to edit it):'
      }
    ]);
    
    // Update placeholder
    setInputPlaceholder("Type the question topic you want to edit...");
  };

  // Function to actually edit a skill after user provides the name
  const editSkill = async (skillName: string) => {
    setLoading(true);
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: localMessages,
          operation: "edit-skill",
          params: {
            recordId: recordId,
            skillName: skillName,
            jobDescription: conversationState.jobDescription,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to edit skill");
      }
      
      const data = await response.json();
      
      // Add the response to the chat
      if (Array.isArray(data) && data.length > 0 && data[0].role === 'assistant') {
        setLocalMessages((prev) => [...prev, data[0]]);
        
        // Check if we have skills data
        const content = data[0].content || "";
        if (content.includes('<skills-data>')) {
          // Reset conversation state to show skills extracted
          setConversationState({
            ...conversationState,
            stage: 'skills_extracted'
          });
        }
      } else {
        throw new Error("Unexpected response format");
      }
      
    } catch (error) {
      console.error("Error editing skill:", error);
      toast.error("Error editing skill. Please try again.");
      
      // Add error message to chat
      setLocalMessages((prev) => [
        ...prev, 
        { 
          id: Date.now().toString(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error while editing the skill. Please try again."
        }
      ]);
    } finally {
      setLoading(false);
      // Reset placeholder
      setInputPlaceholder("Type your message here...");
    }
  };

  // Function to actually edit a question after user provides the topic
  const editQuestion = async (questionTopic: string) => {
    setLoading(true);
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: localMessages,
          operation: "edit-question",
          params: {
            recordId: recordId,
            questionTopic: questionTopic,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to edit question");
      }
      
      const data = await response.json();
      
      // Add the response to the chat
      if (Array.isArray(data) && data.length > 0 && data[0].role === 'assistant') {
        setLocalMessages((prev) => [...prev, data[0]]);
        
        // Check if we have questions data
        const content = data[0].content || "";
        if (content.includes('<questions-data>')) {
          // Reset conversation state to show auto generated
          setConversationState({
            ...conversationState,
            stage: 'auto_generated'
          });
        }
      } else {
        throw new Error("Unexpected response format");
      }
      
    } catch (error) {
      console.error("Error editing question:", error);
      toast.error("Error editing question. Please try again.");
      
      // Add error message to chat
      setLocalMessages((prev) => [
        ...prev, 
        { 
          id: Date.now().toString(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error while editing the question. Please try again."
        }
      ]);
    } finally {
      setLoading(false);
      // Reset placeholder
      setInputPlaceholder("Type your message here...");
    }
  };

  // Handle skill regeneration
  const regenerateSkills = async () => {
    setLoading(true);
    setRegeneratingSkills(true);
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: localMessages,
          operation: "regenerate-skills",
          params: {
            recordId: recordId,
            jobDescription: conversationState.jobDescription,
            useLearningMode: conversationState.useLearningMode,
            interviewLength: conversationState.interviewLength,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to regenerate skills");
      }
      
      const data = await response.json();
      
      // Add the response to the chat
      if (Array.isArray(data) && data.length > 0 && data[0].role === 'assistant') {
        setLocalMessages((prev) => [...prev, data[0]]);
      } else {
        throw new Error("Unexpected response format");
      }
      
    } catch (error) {
      console.error("Error regenerating skills:", error);
      toast.error("Error regenerating skills. Please try again.");
      
      // Add error message to chat
      setLocalMessages((prev) => [
        ...prev, 
        { 
          id: Date.now().toString(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error while regenerating skills. Please try again."
        }
      ]);
    } finally {
      setLoading(false);
      setRegeneratingSkills(false);
    }
  };

  // Handle applying custom instructions
  const applyCustomInstructions = (instructions: string) => {
    setConversationState({
      ...conversationState,
      customInstructions: instructions
    });
    
    // If we have skills extracted, call regenerate with new instructions
    if (conversationState.stage === 'skills_extracted') {
      // Call API with custom instructions for skills
      regenerateSkillsWithCustomInstructions(instructions);
    } else if (conversationState.stage === 'auto_generated') {
      // Call API with custom instructions for auto-generation
      regenerateWithCustomInstructions(instructions);
    }
  };

  // Regenerate skills with custom instructions
  const regenerateSkillsWithCustomInstructions = async (instructions: string) => {
    setLoading(true);
    setRegeneratingWithInstructions(true);
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: localMessages,
          operation: "regenerate-skills",
          params: {
            recordId: recordId,
            jobDescription: conversationState.jobDescription,
            useLearningMode: conversationState.useLearningMode,
            interviewLength: conversationState.interviewLength,
            customInstructions: instructions,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to apply custom instructions");
      }
      
      const data = await response.json();
      
      // Add the response to the chat
      if (Array.isArray(data) && data.length > 0 && data[0].role === 'assistant') {
        setLocalMessages((prev) => [...prev, data[0]]);
      } else {
        throw new Error("Unexpected response format");
      }
      
    } catch (error) {
      console.error("Error applying custom instructions:", error);
      toast.error("Error applying custom instructions. Please try again.");
      
      // Add error message to chat
      setLocalMessages((prev) => [
        ...prev, 
        { 
          id: Date.now().toString(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error while applying your custom instructions. Please try again."
        }
      ]);
    } finally {
      setLoading(false);
      setRegeneratingWithInstructions(false);
    }
  };

  // Regenerate auto-generated content with custom instructions
  const regenerateWithCustomInstructions = async (instructions: string) => {
    setLoading(true);
    setRegeneratingWithInstructions(true);
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: localMessages,
          operation: "regenerate-auto",
          params: {
            recordId: recordId,
            jobDescription: conversationState.jobDescription,
            useLearningMode: conversationState.useLearningMode,
            interviewLength: conversationState.interviewLength,
            customInstructions: instructions,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to apply custom instructions");
      }
      
      const data = await response.json();
      
      // Add the response to the chat
      if (Array.isArray(data) && data.length > 0 && data[0].role === 'assistant') {
        setLocalMessages((prev) => [...prev, data[0]]);
      } else {
        throw new Error("Unexpected response format");
      }
      
    } catch (error) {
      console.error("Error applying custom instructions:", error);
      toast.error("Error applying custom instructions. Please try again.");
      
      // Add error message to chat
      setLocalMessages((prev) => [
        ...prev, 
        { 
          id: Date.now().toString(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error while applying your custom instructions. Please try again."
        }
      ]);
    } finally {
      setLoading(false);
      setRegeneratingWithInstructions(false);
    }
  };

  // Handle restarting the conversation
  const restartConversation = () => {
    // Reset conversation state
    setConversationState({
      stage: 'initial',
      jobDescription: '',
      useLearningMode: false,
      interviewLength: 60,
      customInstructions: '',
      skillToEdit: '',
    });
    
    // Clear messages except the welcome message
    setLocalMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Welcome to the Job Description Analyzer! Please share your job description, and I'll help you extract key skills and generate relevant interview questions."
    }]);
    
    // Reset record and skills
    setRecordId(null);
    setSkills([]);
    setQuestions([]);
  };

  // Regenerate all content
  const regenerateAll = async () => {
    setLoading(true);
    setRegeneratingAll(true);
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: localMessages,
          operation: "regenerate-all",
          params: {
            recordId: recordId,
            jobDescription: conversationState.jobDescription,
            useLearningMode: conversationState.useLearningMode,
            interviewLength: conversationState.interviewLength,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to regenerate content");
      }
      
      const data = await response.json();
      
      // Add the response to the chat
      if (Array.isArray(data) && data.length > 0 && data[0].role === 'assistant') {
        setLocalMessages((prev) => [...prev, data[0]]);
      } else {
        throw new Error("Unexpected response format");
      }
      
    } catch (error) {
      console.error("Error regenerating content:", error);
      toast.error("Error regenerating content. Please try again.");
      
      // Add error message to chat
      setLocalMessages((prev) => [
        ...prev, 
        { 
          id: Date.now().toString(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error while regenerating content. Please try again."
        }
      ]);
    } finally {
      setLoading(false);
      setRegeneratingAll(false);
    }
  };

  // Add function to handle skill click for editing
  const handleSkillClick = (skillName: string) => {
    if (conversationState.stage === 'edit_skill') {
      // Set the input value to the clicked skill name
      handleInputChange({ target: { value: skillName } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  // Add function to handle question click for editing
  const handleQuestionClick = (questionText: string) => {
    if (conversationState.stage === 'edit_question') {
      // Set the input value to the clicked question text (first 30 chars)
      const shortQuestionText = questionText.length > 30 
        ? questionText.substring(0, 30) + '...' 
        : questionText;
      handleInputChange({ target: { value: shortQuestionText } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  // Update the skills table rendering in renderMessageContent function to make skills clickable
  const renderSkillsTable = (skillsData: any) => {
    if (!skillsData || !skillsData.skills || skillsData.skills.length === 0) return null;
    
    return (
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
                <TableRow 
                  key={skill.id} 
                  className={cn(
                    "hover:bg-muted/50",
                    conversationState.stage === 'edit_skill' && "cursor-pointer hover:bg-blue-50"
                  )}
                  onClick={() => handleSkillClick(skill.name)}
                >
                  <TableCell className="font-medium py-2">
                    {skill.name}
                    {conversationState.stage === 'edit_skill' && (
                      <span className="ml-2 text-xs text-blue-500">(click to edit)</span>
                    )}
                  </TableCell>
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
    );
  };

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
      <Card className="mb-8 border-0 shadow-sm bg-gradient-to-b from-white to-gray-50/50">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Job Description QnA</CardTitle>
          <CardDescription className="text-gray-500">
            Chat with AI to analyze job descriptions and create tailored interview questions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div 
            ref={messagesContainerRef}
            className="h-[600px] overflow-y-auto border border-gray-100 rounded-xl p-4 mb-4 bg-white/80 backdrop-blur-sm shadow-[0_2px_8px_-3px_rgba(0,0,0,0.1)]">
            {localMessages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                Start a conversation by entering your job description
              </div>
            ) : (
              <>
                {localMessages.map((message, index) => (
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
                        "shadow-sm transition-all duration-200",
                        message.role === "user" 
                          ? ((message as any).isJobDescription 
                              ? "rounded-2xl px-5 py-3 max-w-[85%] bg-blue-500 text-white"
                              : "rounded-2xl px-5 py-3 max-w-[85%] bg-blue-500 text-white")
                          : (extractSkillsData(message.content || "") 
                              ? "rounded-2xl px-5 py-4 max-w-[90%] bg-gray-50/80 backdrop-blur-sm w-[90%] border border-gray-100"
                              : "rounded-2xl px-5 py-3 max-w-[85%] bg-gray-50/80 backdrop-blur-sm border border-gray-100")
                      )}
                    >
                      {message.role === "user" ? (
                        (message as any).isJobDescription ? (
                          <div>
                            <div className="text-sm font-medium mb-2">Job Description</div>
                            <div className="whitespace-pre-line max-h-[200px] overflow-y-auto bg-blue-600/30 p-3 rounded text-sm">{message.content}</div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-line">{message.content}</div>
                        )
                      ) : (
                        renderMessageContent(message.content || "")
                      )}
                    </div>
                  </div>
                ))}

                {/* Render interactive prompt options */}
                {renderPromptOptions()}

                {(localLoading || isLoading) && (
                  <div className="flex justify-start mb-4">
                    <div className="rounded-2xl px-5 py-3 max-w-[80%] bg-gray-50/80 backdrop-blur-sm border border-gray-100 shadow-sm">
                      <Spinner size="sm" className="mr-2 text-blue-500" />
                      Thinking...
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Debug mode toggle with improved styling */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox" 
                id="debug-mode"
                checked={debugMode}
                onChange={() => setDebugMode(!debugMode)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <label htmlFor="debug-mode" className="text-sm text-gray-500 hover:text-gray-700">
                Debug Mode ({debugMode ? "Test API" : "Real API"})
              </label>
            </div>
            
            {debugMode && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleManualSubmit}
                disabled={!input.trim() || isLoading || localLoading}
                className="border-gray-200 hover:bg-gray-50 text-gray-700"
              >
                Test Send
              </Button>
            )}
          </div>
          
          {/* Debug info panel with improved styling */}
          {debugMode && renderDebugSection()}
        </CardContent>
        <CardFooter>
          <form onSubmit={customHandleSubmit} className="flex w-full gap-3">
            <Input
              placeholder={inputPlaceholder}
              value={input}
              onChange={handleInputChange}
              className="flex-1 border-gray-200 focus:ring-2 focus:ring-blue-500/20 rounded-xl placeholder:text-gray-400"
            />
            <Button 
              type="submit" 
              disabled={isLoading || localLoading || !input.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-sm transition-colors"
            >
              Send
            </Button>
          </form>
        </CardFooter>
      </Card>

      {recordId && questions.length > 0 && (
        <Card className="mb-8 border-0 shadow-sm bg-gradient-to-b from-white to-gray-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Interview Questions</CardTitle>
                <CardDescription className="text-gray-500">Generated questions based on identified skills</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchLatestQuestions}
                  disabled={loading}
                  className="border-gray-200 hover:bg-gray-50 text-gray-700"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-gray-100 relative overflow-x-auto bg-white/80 backdrop-blur-sm shadow-[0_2px_8px_-3px_rgba(0,0,0,0.1)]">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="hover:bg-gray-50/50">
                    <TableHead className="w-[12%] text-gray-700">Skill</TableHead>
                    <TableHead className="w-[10%] text-gray-700">Category</TableHead>
                    <TableHead className="w-[12%] text-gray-700">Format</TableHead>
                    <TableHead className="w-[46%] text-gray-700">Question</TableHead>
                    <TableHead className="w-[20%] text-right text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedQuestions.map((question, index) => {
                    const isNewSkillGroup = question.skillId !== currentSkillId;
                    currentSkillId = question.skillId;

                    return (
                      <>
                        {isNewSkillGroup && (
                          <TableRow key={`header-${question.skillId}`} className="bg-gray-50/50">
                            <TableCell colSpan={5} className="py-3">
                              <span className="font-semibold text-gray-700">{getSkillName(question.skillId)}</span>
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow 
                          key={question.id}
                          className={cn(
                            "transition-colors",
                            question.liked === "LIKED" && "bg-green-50/50 hover:bg-green-50/70",
                            question.liked === "DISLIKED" && "bg-red-50/50 hover:bg-red-50/70",
                            !question.liked && "hover:bg-gray-50/50",
                            conversationState.stage === 'edit_question' && "cursor-pointer hover:bg-blue-100"
                          )}
                          onClick={() => {
                            if (conversationState.stage === 'edit_question') {
                              handleQuestionClick(question.question);
                            }
                          }}
                        >
                          <TableCell>
                            <div className="pl-4">
                              <span className="text-sm text-gray-500">
                                Question {index + 1}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${getCategoryClass(
                                question.category
                              )}`}
                            >
                              {question.category}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${getQuestionFormatClass(
                                question.questionFormat || "Scenario"
                              )}`}
                            >
                              {question.questionFormat || "Scenario"}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-gray-700">
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
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row click
                                  handleQuestionStatusChange(question.id, "LIKED");
                                }}
                                className={cn(
                                  "h-8 w-8 transition-colors",
                                  question.liked === "LIKED" ? "bg-green-100 text-green-700 hover:bg-green-200" : "hover:bg-gray-100"
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
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row click
                                  handleQuestionStatusChange(question.id, "DISLIKED");
                                }}
                                className={cn(
                                  "h-8 w-8 transition-colors",
                                  question.liked === "DISLIKED" ? "bg-red-100 text-red-700 hover:bg-red-200" : "hover:bg-gray-100"
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
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row click
                                  handleRegenerateQuestion(question.id);
                                }}
                                disabled={loading}
                                className="hover:bg-gray-100 transition-colors"
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
