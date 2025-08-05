"use client";

import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import {
  Download,
  RefreshCw,
  ArrowLeft,
  Info,
  Trash2,
  GripVertical,
  MessageSquare,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";
import PDFDoc from "./PDFDocument";
import { Question as PDFQuestion } from "./ui/questions-display";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { QuestionDialog } from "./ui/question-dialog";
import { DeleteQuestionDialog } from "./ui/delete-question-dialog";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import SkillsTable from "./SkillsTable";
import { GlobalFeedbackDialog } from "./ui/global-feedback-dialog";
import { QuestionGenerationDialog } from "./ui/question-generation-dialog";
import { Checkbox } from "./ui/checkbox";

// Define interfaces for the types from Prisma
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
  floCareerId?: number;
  deleted?: boolean;
}

interface Question {
  id: string;
  content: string;
  skillId: string;
  recordId: string;
  liked?: "LIKED" | "DISLIKED" | "NONE";
  skill?: Skill;
  feedback?: string;
  floCareerId?: number;
  floCareerPoolId?: number;
  deleted?: boolean;
  deletedFeedback?: string;
}

interface SkillRecord {
  id: string;
  jobTitle: string;
  createdAt: Date;
  updatedAt: Date;
  reqId?: number;
  userId?: number;
  roundId?: number;
}

type RecordWithRelations = SkillRecord & {
  skills: Skill[];
  questions: (Question & {
    skill: Skill;
  })[];
};

// Interface for parsed question data
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
  coding?: boolean;
  floCareerId?: number;
  floCareerPoolId?: number;
  deleted?: boolean;
  deletedFeedback?: string;
}

interface SkillRecordEditorProps {
  record: RecordWithRelations;
  defaultTab?: string;
}

export default function SkillRecordEditor({
  record,
  defaultTab,
}: SkillRecordEditorProps) {
  const router = useRouter();
  const [editedSkills, setEditedSkills] = useState<Skill[]>(record.skills);
  const [questions, setQuestions] = useState<QuestionData[]>(
    formatQuestions(record.questions)
  );
  const [loading, setLoading] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [regeneratingQuestions, setRegeneratingQuestions] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(
    defaultTab && (defaultTab === "questions" || defaultTab === "skills")
      ? defaultTab
      : "skills"
  );
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [feedbackRefreshTrigger, setFeedbackRefreshTrigger] = useState(0);
  const [activeSkillFeedback, setActiveSkillFeedback] = useState<string | null>(
    null
  );
  const [skillFeedbackCounts, setSkillFeedbackCounts] = useState<
    Record<string, number>
  >({});
  const [priorityMode, setPriorityMode] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [globalFeedbackDialogOpen, setGlobalFeedbackDialogOpen] =
    useState(false);
  const [globalFeedback, setGlobalFeedback] = useState("");
  const [loadingGlobalFeedback, setLoadingGlobalFeedback] = useState(false);
  const [questionGenerationDialogOpen, setQuestionGenerationDialogOpen] =
    useState(false);
  const [generationProgress, setGenerationProgress] = useState({
    title: "Generating Questions",
    description:
      "Please wait while we generate interview questions for your skills...",
    showProgress: false,
    progressValue: 0,
    progressText: "",
  });

  // Multi-select state for priority mode
  const [selectedSkillsInPriorityMode, setSelectedSkillsInPriorityMode] =
    useState<Set<string>>(new Set());
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [excelExporting, setExcelExporting] = useState(false);

  const [skillRegenerationDialogOpen, setSkillRegenerationDialogOpen] =
    useState(false);
  const [activeSkillForRegeneration, setActiveSkillForRegeneration] = useState<
    string | null
  >(null);

  // Add state for the confirmation dialog
  const [confirmRequirementChangeOpen, setConfirmRequirementChangeOpen] =
    useState(false);
  const [pendingRequirementChange, setPendingRequirementChange] = useState<{
    skillId: string;
    skillName: string;
    questionCount: number;
  } | null>(null);

  // Add state for saving to FloCareer
  const [savingToFloCareer, setSavingToFloCareer] = useState(false);

  // Add state for creating interview structure
  const [creatingInterviewStructure, setCreatingInterviewStructure] =
    useState(false);

  // Add state for final submit dialog
  const [finalSubmitDialogOpen, setFinalSubmitDialogOpen] = useState(false);

  // Add state for delete question dialog
  const [deleteQuestionDialogOpen, setDeleteQuestionDialogOpen] =
    useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(
    null
  );
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  // Track deleted skills for FloCareer submission (only current session)
  const [deletedSkills, setDeletedSkills] = useState<
    Array<{
      id: string;
      name: string;
      floCareerId?: number;
      poolId?: number;
      level: string;
      requirement: string;
    }>
  >([]);

  // Track deleted questions for summary dialog (only current session)
  const [deletedQuestions, setDeletedQuestions] = useState<
    Array<{
      id: string;
      question: string;
      skillName: string;
      floCareerId?: number;
      floCareerPoolId?: number;
    }>
  >([]);

  // Track skills deleted in current session (not from database)
  const [sessionDeletedSkills, setSessionDeletedSkills] = useState<Set<string>>(
    new Set()
  );

  // Track questions deleted in current session (not from database)
  const [sessionDeletedQuestions, setSessionDeletedQuestions] = useState<
    Set<string>
  >(new Set());

  // Helper function to get total deleted questions in current session
  const getTotalDeletedQuestionsInSession = () => {
    // Count questions from skills deleted in current session
    const deletedQuestionsFromSessionSkills = editedSkills
      .filter((skill) => sessionDeletedSkills.has(skill.id))
      .flatMap((skill) =>
        questions.filter((q) => q.skillId === skill.id)
      ).length;

    // Count individually deleted questions in current session
    const individuallyDeletedQuestions = sessionDeletedQuestions.size;

    return deletedQuestionsFromSessionSkills + individuallyDeletedQuestions;
  };

  // Helper function to get total deleted skills in current session
  const getTotalDeletedSkillsInSession = () => {
    return sessionDeletedSkills.size;
  };

  // Parse question content from JSON string
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
            coding: content.coding || false,
            floCareerId: q.floCareerId,
            floCareerPoolId: q.floCareerPoolId,
            deleted: q.deleted || false,
            deletedFeedback: q.deletedFeedback || "",
          };
        } catch (e) {
          console.error("Error parsing question content:", e);
          return null;
        }
      })
      .filter(Boolean) as QuestionData[];
  }

  // Update skill level and requirement
  const updateSkill = async (
    skillId: string,
    field:
      | "level"
      | "requirement"
      | "numQuestions"
      | "difficulty"
      | "priority"
      | "category"
      | "questionFormat",
    value: string | number
  ) => {
    // Special handling for changing requirement from MANDATORY to OPTIONAL
    if (field === "requirement" && value === "OPTIONAL") {
      const skill = editedSkills.find((s) => s.id === skillId);
      const questionCount = getSkillQuestionCount(skillId);

      if (skill?.requirement === "MANDATORY" && questionCount > 0) {
        // Store the pending change and show confirmation dialog
        setPendingRequirementChange({
          skillId,
          skillName: skill.name,
          questionCount,
        });
        setConfirmRequirementChangeOpen(true);
        return; // Don't proceed with update yet
      }
    }

    try {
      setLoading(true);

      // Update locally first
      const updatedSkills = editedSkills.map((skill) =>
        skill.id === skillId ? { ...skill, [field]: value } : skill
      );
      setEditedSkills(updatedSkills);

      // Then update in database
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
        },
        body: JSON.stringify({ [field]: value }),
      });

      toast.success(`Skill ${field} updated successfully`);
      router.refresh();
    } catch (error) {
      console.error(`Error updating skill ${field}:`, error);
      toast.error(`Failed to update skill ${field}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate questions using the API endpoint for the record
  const generateQuestionsForRecord = async (force = false) => {
    try {
      setGeneratingQuestions(true);
      setQuestionGenerationDialogOpen(true);
      setGenerationProgress({
        title: force ? "Regenerating All Questions" : "Generating Questions",
        description: force
          ? "Regenerating all interview questions with fresh content..."
          : "Creating interview questions for your skills...",
        showProgress: false,
        progressValue: 0,
        progressText: "",
      });

      const response = await fetch(
        `/api/records/${record.id}/generate-questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
          body: JSON.stringify({
            forceRegenerate: force,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Show success toast
        toast.success(`${data.message || "Questions generated successfully!"}`);

        // Fetch the latest questions directly
        await fetchLatestQuestions();

        // Switch to questions tab
        setActiveTab("questions");
      } else {
        // Only show error if there's actually an error message
        if (data.error) {
          toast.error(data.error);
        } else {
          // If no specific error but questions might have been generated, just show info
          toast.info(
            "Questions generation completed. Check the questions tab."
          );

          // Still try to fetch latest questions in case some were generated
          await fetchLatestQuestions();
          setActiveTab("questions");
        }
      }
    } catch (error: any) {
      console.error("Error generating questions:", error);
      // Only show error toast for actual errors, not network issues
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        toast.error(
          "Network error. Please check your connection and try again."
        );
      } else if (error.message) {
        toast.error(error.message);
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    } finally {
      setGeneratingQuestions(false);
      setQuestionGenerationDialogOpen(false);
    }
  };

  // Generate questions for specific selected skills
  const generateQuestionsForSelectedSkills = async (skillIds: string[]) => {
    try {
      setGeneratingQuestions(true);
      setQuestionGenerationDialogOpen(true);
      setGenerationProgress({
        title: "Generating Questions for Selected Skills",
        description: "Creating interview questions for your selected skills...",
        showProgress: false,
        progressValue: 0,
        progressText: "",
      });

      const response = await fetch(
        `/api/records/${record.id}/generate-questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
          body: JSON.stringify({
            skillIds: skillIds,
            forceRegenerate: false,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Show success toast
        toast.success(
          `${
            data.message ||
            "Questions generated successfully for selected skills!"
          }`
        );

        // Fetch the latest questions directly
        await fetchLatestQuestions();

        // Switch to questions tab
        setActiveTab("questions");
      } else {
        // Only show error if there's actually an error message
        if (data.error) {
          toast.error(data.error);
        } else {
          // If no specific error but questions might have been generated, just show info
          toast.info(
            "Questions generation completed. Check the questions tab."
          );

          // Still try to fetch latest questions in case some were generated
          await fetchLatestQuestions();
          setActiveTab("questions");
        }
      }
    } catch (error: any) {
      console.error("Error generating questions for selected skills:", error);
      // Only show error toast for actual errors, not network issues
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        toast.error(
          "Network error. Please check your connection and try again."
        );
      } else if (error.message) {
        toast.error(error.message);
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    } finally {
      setGeneratingQuestions(false);
      setQuestionGenerationDialogOpen(false);
    }
  };

  // Auto-generate skills and questions in one go
  const autoGenerateSkillsAndQuestions = async () => {
    try {
      setGeneratingQuestions(true);
      setQuestionGenerationDialogOpen(true);
      setGenerationProgress({
        title: "Auto-Generating Skills & Questions",
        description:
          "Analyzing job requirements and creating comprehensive interview content...",
        showProgress: true,
        progressValue: 10,
        progressText: "Extracting skills from job description...",
      });

      // Update progress
      setGenerationProgress((prev) => ({
        ...prev,
        progressValue: 30,
        progressText: "Generating interview questions...",
      }));

      // Call the API endpoint that handles both skill and question generation
      const response = await fetch(`/api/records/${record.id}/auto-generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
        },
        body: JSON.stringify({
          jobTitle: record.jobTitle,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to auto-generate skills and questions");
      }

      const data = await response.json();

      if (data.success) {
        // Update progress
        setGenerationProgress((prev) => ({
          ...prev,
          progressValue: 80,
          progressText: "Finalizing questions...",
        }));

        // Show success toast
        toast.success(
          `${data.message || "Successfully generated skills and questions!"}`
        );

        // Update the skills list
        if (data.skills) {
          setEditedSkills(data.skills);
        }

        // Fetch the latest questions
        await fetchLatestQuestions();

        // Final progress update
        setGenerationProgress((prev) => ({
          ...prev,
          progressValue: 100,
          progressText: "Complete!",
        }));

        // Switch to questions tab
        setActiveTab("questions");

        // Refresh the page to update all data
        router.refresh();
      } else {
        throw new Error(data.error || "Failed to auto-generate");
      }
    } catch (error: any) {
      console.error("Error auto-generating:", error);
      toast.error(
        error.message || "Error auto-generating skills and questions"
      );
    } finally {
      setGeneratingQuestions(false);
      setQuestionGenerationDialogOpen(false);
    }
  };

  // Add a new function to fetch global feedback
  const fetchGlobalFeedback = async () => {
    try {
      setLoadingGlobalFeedback(true);
      const response = await fetch(
        `/api/records/${record.id}/global-feedback`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.globalFeedback) {
          setGlobalFeedback(data.globalFeedback.content || "");
        }
      }
    } catch (error) {
      console.error("Error fetching global feedback:", error);
    } finally {
      setLoadingGlobalFeedback(false);
    }
  };

  // Call fetchGlobalFeedback when component mounts
  useEffect(() => {
    fetchGlobalFeedback();
  }, [record.id]);

  // Clear deleted tracking when record changes
  useEffect(() => {
    setDeletedSkills([]);
    setDeletedQuestions([]);
    setSessionDeletedSkills(new Set());
    setSessionDeletedQuestions(new Set());
  }, [record.id]);

  // Update the regenerate function to include global feedback
  const regenerateAllQuestions = () => {
    // Show confirmation dialog
    if (
      confirm(
        "This will regenerate ALL questions for mandatory skills. Are you sure?"
      )
    ) {
      // First check if there are questions with feedback
      const questionsWithFeedback = questions.filter(
        (q) => q.feedback && q.feedback.trim() !== ""
      );

      const hasGlobalFeedback = globalFeedback && globalFeedback.trim() !== "";

      if (questionsWithFeedback.length > 0 || hasGlobalFeedback) {
        // If we have questions with feedback or global feedback, regenerate with feedback
        regenerateQuestionsWithFeedback();
      } else {
        // Otherwise, generate all questions as usual
        generateQuestionsForRecord(true);
      }
    }
  };

  // Update the regenerateQuestionsWithFeedback function to include global feedback
  const regenerateQuestionsWithFeedback = async () => {
    try {
      setRegeneratingQuestions(true);
      setQuestionGenerationDialogOpen(true);
      setGenerationProgress({
        title: "Regenerating with Feedback",
        description:
          "Applying your feedback to improve the interview questions...",
        showProgress: false,
        progressValue: 0,
        progressText: "",
      });

      // Collect the feedback for API
      const feedbackData = questions
        .filter((q) => q.feedback && q.feedback.trim() !== "")
        .map((q) => ({
          questionId: q.id,
          feedback: q.feedback,
        }));

      // Call the API to regenerate questions with feedback
      const response = await fetch(
        `/api/records/${record.id}/regenerate-with-feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
          body: JSON.stringify({
            feedback: feedbackData,
            globalFeedback: globalFeedback || null,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Show success toast
        toast.success(
          `${data.message || "Questions regenerated based on feedback!"}`
        );

        // Fetch the latest questions directly
        await fetchLatestQuestions();

        // Switch to questions tab
        setActiveTab("questions");
      } else {
        // Only show error if there's actually an error message
        if (data.error) {
          toast.error(data.error);
        } else {
          // If no specific error but questions might have been regenerated, just show info
          toast.info(
            "Questions regeneration completed. Check the questions tab."
          );

          // Still try to fetch latest questions in case some were regenerated
          await fetchLatestQuestions();
          setActiveTab("questions");
        }
      }
    } catch (error: any) {
      console.error("Error regenerating questions with feedback:", error);
      // Only show error toast for actual errors, not network issues
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        toast.error(
          "Network error. Please check your connection and try again."
        );
      } else if (error.message) {
        toast.error(error.message);
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }

      // Fall back to regular regeneration if the feedback-based one fails
      generateQuestionsForRecord(true);
    } finally {
      setRegeneratingQuestions(false);
      setQuestionGenerationDialogOpen(false);
    }
  };

  // Add a new function to fetch the latest questions
  const fetchLatestQuestions = async () => {
    try {
      setQuestionsLoading(true);
      const response = await fetch(`/api/records/${record.id}/questions`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }

      const data = await response.json();

      if (data.success) {
        // Update questions state with the latest data
        setQuestions(formatQuestions(data.questions));
      }
    } catch (error) {
      console.error("Error fetching latest questions:", error);
      // Don't show a toast for this error as it's a background operation
    } finally {
      setQuestionsLoading(false);
    }
  };

  // Generate PDF for download
  const handleGeneratePDF = async () => {
    try {
      setPdfLoading(true);

      // Only include liked or neutral questions, not disliked or deleted ones
      const filteredQuestions = questions.filter(
        (q) => q.liked !== "DISLIKED" && !q.deleted
      );

      // Format questions for PDF
      const pdfQuestions = filteredQuestions.map((q) => {
        // Get the skill data for this question
        const skill = editedSkills.find((s) => s.id === q.skillId);

        return {
          question: q.question,
          answer: q.answer,
          category: q.category,
          difficulty: q.difficulty,
          skillName: getSkillName(q.skillId),
          priority: skill?.priority,
          questionFormat: q.questionFormat || "Scenario",
        };
      });

      // Generate PDF
      const blob = await pdf(
        <PDFDoc jobRole={record.jobTitle} questions={pdfQuestions} />
      ).toBlob();

      // Generate filename
      const fileName = `${record.jobTitle
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()}_interview_questions.pdf`;

      // Save file
      saveAs(blob, fileName);
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error generating PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  // Generate and download Excel
  const handleGenerateExcel = async () => {
    if (!questions.length) {
      toast.error("No questions to export");
      return;
    }

    setExcelExporting(true);
    try {
      const jobTitle = record.jobTitle || "interview-questions";
      const filename = `${jobTitle
        .toLowerCase()
        .replace(/\s+/g, "-")}-${Date.now()}.xlsx`;

      // Prepare questions data for export (exclude deleted questions)
      const activeQuestions = questions.filter((q) => !q.deleted);
      const exportQuestions = activeQuestions.map((q, index) => {
        const skill = editedSkills.find((s) => s.id === q.skillId);
        return {
          slNo: index + 1,
          corpId: "", // Empty as per default
          urlId: "", // Empty as per default
          roundSequence: 1, // Default to 1
          skillName: skill?.name || "Unknown Skill",
          question: q.question,
          answer: q.answer,
          category: q.category,
          questionFormat:
            q.questionFormat || skill?.questionFormat || "Scenario",
          candidateDescription: q.question, // Default to Question Description
          candidateFacingDocUrl: "", // Empty as per default
          tags: `${q.category || ""}, ${
            q.questionFormat || skill?.questionFormat || ""
          }`.replace(/^, |, $/, ""),
          coding: q.coding || false,
          mandatory: "No", // Default to No
          hideInFloReport: "No", // Default to No
          poolName: skill?.name || "Unknown Skill", // Fixed: Use skill name for pool
        };
      });

      const response = await fetch("/api/export-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
        },
        body: JSON.stringify({
          questions: exportQuestions,
          format: "excel",
          filename,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to export questions");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Questions exported to Excel successfully!");
    } catch (error: any) {
      console.error("Error exporting to Excel:", error);
      toast.error(error.message || "Failed to export to Excel");
    } finally {
      setExcelExporting(false);
    }
  };

  // Get skill name for a given skillId
  const getSkillName = (skillId: string) => {
    const skill = editedSkills.find((s) => s.id === skillId);
    return skill ? skill.name : "Unknown Skill";
  };

  // Get level label
  const getLevelLabel = (level: string) => {
    switch (level) {
      case "BEGINNER":
        return "Beginner";
      case "INTERMEDIATE":
        return "Intermediate";
      case "PROFESSIONAL":
        return "Professional";
      default:
        return level;
    }
  };

  // Count questions for each skill (excluding deleted questions)
  const getSkillQuestionCount = (skillId: string) => {
    return questions.filter((q) => q.skillId === skillId && !q.deleted).length;
  };

  // Add useEffect to fetch questions when tab changes
  useEffect(() => {
    if (activeTab === "questions" && questions.length === 0) {
      fetchLatestQuestions();
    }
  }, [activeTab]);

  // Add a new helper method to get the number of questions set for a skill
  const getSkillNumQuestions = (skillId: string) => {
    const skill = editedSkills.find((s) => s.id === skillId);
    return skill?.numQuestions || 1;
  };

  // Add a new helper method to get the skill difficulty
  const getSkillDifficulty = (skillId: string) => {
    const skill = editedSkills.find((s) => s.id === skillId);
    if (skill && typeof skill.level === "string") {
      const level = skill.level;
      return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
    }
    return "Intermediate";
  };

  // Add a helper function to get a CSS class based on category
  const getCategoryClass = (category: string) => {
    if (!category) return "bg-gray-50 text-gray-800 border-gray-200";

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

  // Add a helper function to get a CSS class based on question format
  const getQuestionFormatClass = (format: string) => {
    if (!format) return "bg-amber-50 text-amber-800 border-amber-200";

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

  // Sort questions by skillId then by difficulty, excluding deleted questions
  const sortedQuestions = [...questions]
    .filter((question) => !question.deleted) // Filter out deleted questions
    .sort((a, b) => {
      // First sort by skillId
      if (a.skillId !== b.skillId) {
        return a.skillId.localeCompare(b.skillId);
      }

      // Then by difficulty (Hard, Medium, Easy)
      const difficultyOrder = { Hard: 0, Medium: 1, Easy: 2 };
      const aDiffValue =
        difficultyOrder[a.difficulty as keyof typeof difficultyOrder] ?? 1;
      const bDiffValue =
        difficultyOrder[b.difficulty as keyof typeof difficultyOrder] ?? 1;
      return aDiffValue - bDiffValue;
    });

  // Track the current skill to know when to add a divider
  let currentSkillId = "";

  // Update like status for a question
  const handleQuestionStatusChange = (
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
    fetch(`/api/questions/${questionId}/like`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
      },
      body: JSON.stringify({ status }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to update question status");
        }
        return response.json();
      })
      .then(() => {
        // Success - already updated UI optimistically
      })
      .catch((error) => {
        console.error("Error updating question status:", error);
        toast.error("Failed to update question status");
        // Revert the change in case of error
        setQuestions((prevQuestions) => [...prevQuestions]);
      });
  };

  // Handle feedback submitted for a question
  const handleQuestionFeedbackChange = (
    questionId: string,
    feedback: string
  ) => {
    // Update locally first
    setQuestions((prevQuestions) =>
      prevQuestions.map((q) => (q.id === questionId ? { ...q, feedback } : q))
    );

    // Update in database
    fetch(`/api/questions/${questionId}/feedback`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
      },
      body: JSON.stringify({ feedback }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to update question feedback");
        }
        return response.json();
      })
      .then(() => {
        // Success - already updated UI optimistically
      })
      .catch((error) => {
        console.error("Error updating question feedback:", error);
        toast.error("Failed to update question feedback");
        // Revert the change in case of error
        setQuestions((prevQuestions) => [...prevQuestions]);
      });
  };

  // Handle regenerating a question
  const handleRegenerateQuestion = async (
    questionId: string
  ): Promise<void> => {
    if (!questionId) return;

    try {
      setQuestionsLoading(true);

      const response = await fetch(`/api/questions/${questionId}/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
        },
        body: JSON.stringify({}), // Add empty JSON body to prevent parsing error
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
      } else {
        throw new Error(data.error || "Failed to regenerate question");
      }
    } catch (error) {
      console.error("Error regenerating question:", error);
      toast.error("Failed to regenerate question");
    } finally {
      setQuestionsLoading(false);
    }
  };
  const handleRegenerateDislikeQuestion = async (
    questionId: string
  ): Promise<void> => {
    if (!questionId) return;

    try {
      setQuestionsLoading(true);

      const response = await fetch(
        `/api/questions/${questionId}/regenerate-dislike`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
          body: JSON.stringify({}), // Add empty JSON body to prevent parsing error
        }
      );

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
      } else {
        throw new Error(data.error || "Failed to regenerate question");
      }
    } catch (error) {
      console.error("Error regenerating question:", error);
      toast.error("Failed to regenerate question");
    } finally {
      setQuestionsLoading(false);
    }
  };

  // Get number of liked/disliked questions for a skill (excluding deleted questions)
  const getSkillLikeStats = (skillId: string) => {
    const skillQuestions = questions.filter(
      (q) => q.skillId === skillId && !q.deleted
    );
    const liked = skillQuestions.filter((q) => q.liked === "LIKED").length;
    const disliked = skillQuestions.filter(
      (q) => q.liked === "DISLIKED"
    ).length;
    return { liked, disliked };
  };

  // Handle feedback submitted
  const handleFeedbackSubmitted = () => {
    setFeedbackRefreshTrigger((prev) => prev + 1);
  };

  // Toggle feedback section for a skill
  const toggleFeedbackSection = (skillId: string) => {
    if (activeSkillFeedback === skillId) {
      setActiveSkillFeedback(null);
    } else {
      setActiveSkillFeedback(skillId);
    }
  };

  // Add useEffect to fetch feedback counts when the component mounts
  useEffect(() => {
    const fetchFeedbackCounts = async () => {
      try {
        const feedbackCounts: Record<string, number> = {};

        // Keep existing counts for skills that haven't changed
        const existingCounts = { ...skillFeedbackCounts };

        // Only fetch for skills that don't already have counts and are not deleted
        const skillsToFetch = editedSkills.filter(
          (skill) => !skill.deleted && existingCounts[skill.id] === undefined
        );

        for (const skill of skillsToFetch) {
          const response = await fetch(`/api/skills/${skill.id}/feedback`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${
                process.env.NEXT_PUBLIC_AUTH_TOKEN || ""
              }`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            feedbackCounts[skill.id] = data.feedbacks.length;
          }
        }

        // Combine existing counts with new counts, but only for skills that still exist
        const updatedCounts = { ...existingCounts, ...feedbackCounts };
        const finalCounts: Record<string, number> = {};

        // Filter out counts for skills that no longer exist or are deleted
        editedSkills.forEach((skill) => {
          if (!skill.deleted && updatedCounts[skill.id] !== undefined) {
            finalCounts[skill.id] = updatedCounts[skill.id];
          }
        });

        setSkillFeedbackCounts(finalCounts);
      } catch (error) {
        console.error("Error fetching feedback counts:", error);
      }
    };

    fetchFeedbackCounts();
  }, [editedSkills, feedbackRefreshTrigger]);

  // Add a function to handle skill deletion
  const handleDeleteSkill = async (skillId: string) => {
    try {
      setLoading(true);

      // Find the skill to be deleted and track it if it has a FloCareer ID
      const skillToDelete = editedSkills.find((skill) => skill.id === skillId);
      if (skillToDelete && skillToDelete.floCareerId) {
        setDeletedSkills((prevDeleted) => [
          ...prevDeleted,
          {
            id: skillToDelete.id,
            name: skillToDelete.name,
            floCareerId: skillToDelete.floCareerId,
            poolId: skillToDelete.floCareerId, // Using floCareerId as poolId for now
            level: mapSkillLevel(skillToDelete.level),
            requirement: mapSkillRequirement(skillToDelete.requirement),
          },
        ]);
      }

      const response = await fetch(`/api/skills/${skillId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete skill");
      }

      toast.success("Skill deleted successfully");

      // Remove the feedback count for the deleted skill
      setSkillFeedbackCounts((prevCounts) => {
        const newCounts = { ...prevCounts };
        delete newCounts[skillId];
        return newCounts;
      });

      // Track this skill as deleted in current session
      setSessionDeletedSkills((prev) => new Set([...prev, skillId]));

      // Update local state to mark the skill as deleted instead of removing it
      setEditedSkills(
        editedSkills.map((skill) =>
          skill.id === skillId ? { ...skill, deleted: true } : skill
        )
      );

      // Mark related questions as deleted in local state
      setQuestions(
        questions.map((question) =>
          question.skillId === skillId
            ? { ...question, deleted: true }
            : question
        )
      );

      // Mark related questions as deleted in database
      const questionsToDelete = questions.filter((q) => q.skillId === skillId);
      for (const question of questionsToDelete) {
        await fetch(`/api/questions/${question.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
          body: JSON.stringify({ deleted: true }),
        });
      }

      // Refresh the page to get updated data
      router.refresh();
    } catch (error) {
      console.error("Error deleting skill:", error);
      toast.error("Failed to delete skill. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Add bulk delete function
  const handleBulkDeleteSkills = async (skillIds: string[]) => {
    try {
      setLoading(true);

      // Track skills to be deleted if they have FloCareer IDs
      const skillsToDelete = editedSkills.filter(
        (skill) => skillIds.includes(skill.id) && skill.floCareerId
      );

      if (skillsToDelete.length > 0) {
        setDeletedSkills((prevDeleted) => [
          ...prevDeleted,
          ...skillsToDelete.map((skill) => ({
            id: skill.id,
            name: skill.name,
            floCareerId: skill.floCareerId!,
            poolId: skill.floCareerId!, // Using floCareerId as poolId for now
            level: mapSkillLevel(skill.level),
            requirement: mapSkillRequirement(skill.requirement),
          })),
        ]);
      }

      // Delete skills in parallel
      const deletePromises = skillIds.map((skillId) =>
        fetch(`/api/skills/${skillId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
        })
      );

      const responses = await Promise.all(deletePromises);

      // Check if all deletions were successful
      const failedDeletions = responses.filter((response) => !response.ok);

      if (failedDeletions.length > 0) {
        throw new Error(`Failed to delete ${failedDeletions.length} skill(s)`);
      }

      toast.success(`Successfully deleted ${skillIds.length} skill(s)`);

      // Track these skills as deleted in current session
      setSessionDeletedSkills((prev) => new Set([...prev, ...skillIds]));

      // Update local state to mark the skills as deleted instead of removing them
      setEditedSkills(
        editedSkills.map((skill) =>
          skillIds.includes(skill.id) ? { ...skill, deleted: true } : skill
        )
      );

      // Mark related questions as deleted in local state
      setQuestions(
        questions.map((question) =>
          skillIds.includes(question.skillId)
            ? { ...question, deleted: true }
            : question
        )
      );

      // Mark related questions as deleted in database
      const questionsToDelete = questions.filter((q) =>
        skillIds.includes(q.skillId)
      );
      for (const question of questionsToDelete) {
        await fetch(`/api/questions/${question.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
          body: JSON.stringify({ deleted: true }),
        });
      }

      // Refresh the page to get updated data
      router.refresh();
    } catch (error) {
      console.error("Error deleting skills:", error);
      toast.error("Failed to delete some skills. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle skill selection in priority mode
  const handleSkillSelectInPriorityMode = (
    skillId: string,
    checked: boolean
  ) => {
    const newSelected = new Set(selectedSkillsInPriorityMode);
    if (checked) {
      newSelected.add(skillId);
    } else {
      newSelected.delete(skillId);
    }
    setSelectedSkillsInPriorityMode(newSelected);
  };

  // Handle select all in priority mode
  const handleSelectAllInPriorityMode = (checked: boolean) => {
    if (checked) {
      setSelectedSkillsInPriorityMode(
        new Set(
          editedSkills
            .filter((skill) => !skill.deleted)
            .map((skill) => skill.id)
        )
      );
    } else {
      setSelectedSkillsInPriorityMode(new Set());
    }
  };

  // Handle bulk delete in priority mode
  const handleBulkDeleteInPriorityMode = () => {
    if (selectedSkillsInPriorityMode.size === 0) {
      toast.warning("Please select skills to delete");
      return;
    }
    setConfirmBulkDeleteOpen(true);
  };

  // Confirm and execute bulk delete in priority mode
  const confirmBulkDeleteInPriorityMode = async () => {
    await handleBulkDeleteSkills(Array.from(selectedSkillsInPriorityMode));
    setSelectedSkillsInPriorityMode(new Set());
    setConfirmBulkDeleteOpen(false);
  };

  // Get selected skill names for confirmation dialog
  const getSelectedSkillNamesInPriorityMode = () => {
    return editedSkills
      .filter(
        (skill) => !skill.deleted && selectedSkillsInPriorityMode.has(skill.id)
      )
      .map((skill) => skill.name);
  };

  // Check if all skills are selected in priority mode
  const isAllSelectedInPriorityMode =
    editedSkills.filter((skill) => !skill.deleted).length > 0 &&
    selectedSkillsInPriorityMode.size ===
      editedSkills.filter((skill) => !skill.deleted).length;
  const isIndeterminateInPriorityMode =
    selectedSkillsInPriorityMode.size > 0 &&
    selectedSkillsInPriorityMode.size <
      editedSkills.filter((skill) => !skill.deleted).length;

  // Add an onDragEnd function for drag and drop
  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const startIndex = result.source.index;
    const endIndex = result.destination.index;

    if (startIndex === endIndex) return;

    // Determine if we're working with mandatory or optional skills
    const droppableId = result.source.droppableId;
    const isMandatory = droppableId === "mandatory-skills";

    // Get the correct list (excluding deleted skills)
    const skills = isMandatory
      ? editedSkills.filter((s) => s.requirement === "MANDATORY" && !s.deleted)
      : editedSkills.filter((s) => s.requirement === "OPTIONAL" && !s.deleted);

    // Reorder the list
    const [movedSkill] = skills.splice(startIndex, 1);
    skills.splice(endIndex, 0, movedSkill);

    // Update priorities for the reordered list
    const updatedSkills = skills.map((skill, index) => ({
      ...skill,
      priority: index + 1,
    }));

    // Combine with the skills from the other group (excluding deleted skills)
    const otherSkills = editedSkills.filter(
      (s) =>
        !s.deleted &&
        (isMandatory
          ? s.requirement !== "MANDATORY"
          : s.requirement !== "OPTIONAL")
    );

    // Create the new combined list
    const newSkills = [...updatedSkills, ...otherSkills];

    // Update local state
    setEditedSkills(newSkills);

    // Update in database
    try {
      setLoading(true);

      // Update each skill's priority
      for (const skill of updatedSkills) {
        await fetch(`/api/skills/${skill.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
          body: JSON.stringify({ priority: skill.priority }),
        });
      }

      toast.success("Skill priorities updated");
    } catch (error) {
      console.error("Error updating skill priorities:", error);
      toast.error("Failed to update skill priorities");
    } finally {
      setLoading(false);
    }
  };

  // Create separate lists for mandatory and optional skills (excluding deleted skills)
  const mandatorySkills = editedSkills
    .filter((skill) => skill.requirement === "MANDATORY" && !skill.deleted)
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  const optionalSkills = editedSkills
    .filter((skill) => skill.requirement === "OPTIONAL" && !skill.deleted)
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  // Add regenerate all disliked questions function
  const regenerateAllDislikedQuestions = async () => {
    try {
      // Find all disliked questions (excluding deleted ones)
      const dislikedQuestions = questions.filter(
        (q) => q.liked === "DISLIKED" && !q.deleted
      );

      if (dislikedQuestions.length === 0) {
        toast.info("No disliked questions to regenerate");
        return;
      }

      setQuestionsLoading(true);

      // First ensure all feedback is saved to the database
      for (const question of dislikedQuestions) {
        if (question.feedback && question.id) {
          // Submit any feedback that might not be saved yet
          await fetch(`/api/questions/${question.id}/feedback`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${
                process.env.NEXT_PUBLIC_AUTH_TOKEN || ""
              }`,
            },
            body: JSON.stringify({ feedback: question.feedback }),
          });
        }
      }

      // Process each disliked question sequentially
      for (const question of dislikedQuestions) {
        await handleRegenerateDislikeQuestion(question.id);
      }

      toast.success("All disliked questions have been regenerated");
    } catch (error) {
      console.error("Error regenerating questions:", error);
      toast.error("Failed to regenerate all questions");
    } finally {
      setQuestionsLoading(false);
    }
  };

  // Add function to check if there are any disliked questions
  const hasDislikedQuestions = () => {
    return questions.some((q) => q.liked === "DISLIKED" && !q.deleted);
  };

  // Add a function to handle opening the feedback dialog
  const handleOpenFeedbackDialog = (questionId: string) => {
    setActiveQuestion(questionId);
    setFeedbackDialogOpen(true);
  };

  // Add a function to handle submitting feedback
  const handleSubmitFeedback = (feedback: string) => {
    if (activeQuestion) {
      handleQuestionFeedbackChange(activeQuestion, feedback);
    }
    setFeedbackDialogOpen(false);
  };

  const handleDeleteQuestion = async (feedback: string) => {
    if (!questionToDelete) return;

    setDeletingQuestion(true);
    try {
      const response = await fetch(`/api/questions/${questionToDelete.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
        },
        body: JSON.stringify({ deletedFeedback: feedback }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete question");
      }

      // Parse the question content to get the question text
      const questionContent = JSON.parse(questionToDelete.content);
      const skillName = getSkillName(questionToDelete.skillId);

      // Track the deleted question for summary
      setDeletedQuestions((prevDeleted) => [
        ...prevDeleted,
        {
          id: questionToDelete.id,
          question: questionContent.question,
          skillName: skillName,
          floCareerId: questionToDelete.floCareerId,
          floCareerPoolId: questionToDelete.floCareerPoolId,
        },
      ]);

      // Track this question as deleted in current session
      setSessionDeletedQuestions(
        (prev) => new Set([...prev, questionToDelete.id])
      );

      // Update the questions state to reflect the deletion
      setQuestions((prevQuestions) =>
        prevQuestions.map((q) =>
          q.id === questionToDelete.id
            ? { ...q, deleted: true, deletedFeedback: feedback }
            : q
        )
      );

      toast.success("Question deleted successfully");
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error("Failed to delete question");
    } finally {
      setDeletingQuestion(false);
    }
  };

  const handleOpenDeleteQuestionDialog = (question: QuestionData) => {
    // Convert QuestionData to Question format for the dialog
    const questionForDialog: Question = {
      id: question.id,
      content: JSON.stringify({
        question: question.question,
        answer: question.answer,
        category: question.category,
        difficulty: question.difficulty,
        questionFormat: question.questionFormat,
        coding: question.coding,
      }),
      skillId: question.skillId,
      recordId: record.id,
      liked: question.liked,
      feedback: question.feedback,
      floCareerId: question.floCareerId,
      deleted: question.deleted,
      deletedFeedback: question.deletedFeedback,
    };
    setQuestionToDelete(questionForDialog);
    setDeleteQuestionDialogOpen(true);
  };

  const regenerateQuestionsFromSkill = async (skillId: string) => {
    // Set active skill and open dialog
    setActiveSkillForRegeneration(skillId);
    setSkillRegenerationDialogOpen(true);
  };

  const handleSkillRegenerationSubmit = async (feedback: string) => {
    if (!activeSkillForRegeneration) return;

    try {
      setQuestionsLoading(true);
      setSkillRegenerationDialogOpen(false);
      setQuestionGenerationDialogOpen(true);
      setGenerationProgress({
        title: "Regenerating Skill Questions",
        description:
          "Applying your feedback to regenerate questions for this skill...",
        showProgress: false,
        progressValue: 0,
        progressText: "",
      });

      const skillName = getSkillName(activeSkillForRegeneration);

      // Call API to regenerate questions for this skill
      const response = await fetch(
        `/api/records/${record.id}/regenerate-questions-from-skill`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
          body: JSON.stringify({
            skillId: activeSkillForRegeneration,
            feedback: feedback,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to regenerate questions");
      }

      const data = await response.json();

      if (data.success) {
        // Show success toast
        toast.success(`Successfully regenerated questions for ${skillName}`);

        // Fetch the latest questions directly
        await fetchLatestQuestions();
      } else {
        throw new Error(data.error || "Failed to regenerate questions");
      }
    } catch (error: any) {
      console.error("Error regenerating skill questions:", error);
      toast.error(error.message || "Failed to regenerate questions");
    } finally {
      setQuestionsLoading(false);
      setQuestionGenerationDialogOpen(false);
      setActiveSkillForRegeneration(null);
    }
  };

  // Add a function to delete questions for a skill
  const deleteQuestionsForSkill = async (skillId: string) => {
    try {
      setLoading(true);

      // Find questions for this skill (excluding already deleted ones)
      const skillQuestions = questions.filter(
        (q) => q.skillId === skillId && !q.deleted
      );
      if (skillQuestions.length === 0) return;

      const skillName = getSkillName(skillId);

      // Track deleted questions for summary
      const questionsToTrack = skillQuestions.map((question) => ({
        id: question.id,
        question: question.question,
        skillName: skillName,
        floCareerId: question.floCareerId,
        floCareerPoolId: question.floCareerPoolId,
      }));

      setDeletedQuestions((prevDeleted) => [
        ...prevDeleted,
        ...questionsToTrack,
      ]);

      // Track these questions as deleted in current session
      const questionIds = skillQuestions.map((q) => q.id);
      setSessionDeletedQuestions((prev) => new Set([...prev, ...questionIds]));

      // Delete each question
      for (const question of skillQuestions) {
        await fetch(`/api/questions/${question.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
        });
      }

      // Update local state
      setQuestions(questions.filter((q) => q.skillId !== skillId));

      toast.success("Questions deleted successfully");
    } catch (error) {
      console.error("Error deleting questions:", error);
      toast.error("Failed to delete questions");
    } finally {
      setLoading(false);
    }
  };

  // Add a function to confirm the requirement change
  const confirmRequirementChange = async (deleteQuestions: boolean) => {
    if (!pendingRequirementChange) return;

    try {
      setLoading(true);
      const { skillId } = pendingRequirementChange;

      if (deleteQuestions) {
        // First delete associated questions
        await deleteQuestionsForSkill(skillId);
      }

      // Update skill requirement to OPTIONAL but don't reset numQuestions to 0
      // This allows optional skills to still have questions generated if numQuestions > 0
      const updatedSkills = editedSkills.map((skill) =>
        skill.id === skillId
          ? { ...skill, requirement: "OPTIONAL" as const }
          : skill
      );
      setEditedSkills(updatedSkills);

      // Update in database - only change the requirement
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
        },
        body: JSON.stringify({ requirement: "OPTIONAL" }),
      });

      toast.success(
        `Skill updated to Optional${
          deleteQuestions ? " and questions deleted" : ""
        }`
      );
      router.refresh();
    } catch (error) {
      console.error("Error updating skill:", error);
      toast.error("Failed to update skill");
    } finally {
      setLoading(false);
      setConfirmRequirementChangeOpen(false);
      setPendingRequirementChange(null);
    }
  };

  // Add a component for the feedback dialog
  const FeedbackDialog = () => {
    const question = questions.find((q) => q.id === activeQuestion);
    const [feedback, setFeedback] = useState(question?.feedback || "");

    useEffect(() => {
      if (question) {
        setFeedback(question.feedback || "");
      }
    }, [question]);

    if (!question) return null;

    return (
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Feedback for Question</DialogTitle>
            <DialogDescription>
              Please provide your feedback to improve this question.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium mb-2">{question.question}</p>
            <textarea
              className="w-full min-h-[100px] p-2 border rounded-md"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What would you like to improve about this question?"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFeedbackDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => handleSubmitFeedback(feedback)}>
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Add the skill regeneration dialog component
  const SkillRegenerationDialog = () => {
    const skill = editedSkills.find((s) => s.id === activeSkillForRegeneration);
    // Add local state for feedback
    const [feedback, setFeedback] = useState("");

    if (!skill) return null;

    return (
      <Dialog
        open={skillRegenerationDialogOpen}
        onOpenChange={(open) => {
          setSkillRegenerationDialogOpen(open);
          if (open) setFeedback(""); // Reset feedback when dialog opens
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate Questions for {skill.name}</DialogTitle>
            <DialogDescription>
              Provide feedback to improve all questions for this skill. This
              will regenerate all existing questions.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              className="w-full min-h-[150px] p-2 border rounded-md"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What would you like to improve about the questions for this skill? (Optional)"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSkillRegenerationDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => handleSkillRegenerationSubmit(feedback)}>
              Regenerate Questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Helper functions to map skill data to FloCareer format
  const mapSkillLevel = (level: string): string => {
    switch (level) {
      case "BEGINNER":
        return "Entry-Level";
      case "INTERMEDIATE":
        return "Intermediate";
      case "PROFESSIONAL":
        return "Professional";
      case "EXPERT":
        return "Expert";
      default:
        return "Intermediate";
    }
  };

  const mapSkillRequirement = (requirement: string): string => {
    switch (requirement) {
      case "MANDATORY":
        return "Must-have";
      case "OPTIONAL":
        return "Should-have";
      default:
        return "Should-have";
    }
  };

  // Add function to get query parameters
  const getQueryParam = (name: string) => {
    console.log("....", window.location.search);
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(window.location.href);
    if (!results) return null;
    if (!results[2]) return "";
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  };

  // Combined function to save both skills and questions to FloCareer
  const finalSubmitToFloCareer = async () => {
    if (!record.reqId || !record.userId) {
      toast.error("Missing required information for FloCareer integration");
      return;
    }

    if (editedSkills.length === 0) {
      toast.error("No skills to save to FloCareer");
      return;
    }

    const activeQuestions = questions.filter((q) => !q.deleted);
    if (activeQuestions.length === 0) {
      toast.error("No questions to save to FloCareer");
      return;
    }

    try {
      setSavingToFloCareer(true);

      // Step 1: Save skills to FloCareer
      const skillMatrix = [
        // Add new/existing skills (only non-deleted skills)
        ...editedSkills
          .filter((skill) => !skill.deleted)
          .map((skill) => ({
            ai_skill_id: skill.id,
            skill_id: skill.floCareerId || 0,
            action: skill.floCareerId ? "edit" : "add",
            name: skill.name,
            level: mapSkillLevel(skill.level),
            requirement: mapSkillRequirement(skill.requirement),
          })),
        // Add deleted skills with delete action
        ...deletedSkills.map((skill) => ({
          ai_skill_id: skill.id,
          skill_id: skill.floCareerId || 0,
          action: "delete",
          name: skill.name,
          level: mapSkillLevel(skill.level),
          requirement: mapSkillRequirement(skill.requirement),
        })),
      ];

      const skillRequestBody = {
        round_id: record.roundId,
        user_id: record.userId,
        skill_matrix: skillMatrix,
      };
      console.log("skillRequestBody", skillRequestBody);
      console.log("Deleted skills being submitted:", deletedSkills);

      const skillResponse = await fetch(
        "https://sandbox.flocareer.com/dynamic/corporate/create-skills/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(skillRequestBody),
        }
      );

      if (!skillResponse.ok) {
        throw new Error(`FloCareer Skills API error: ${skillResponse.status}`);
      }

      const skillResult = await skillResponse.json();
      console.log("skillResult", skillResult);

      if (!skillResult.success) {
        throw new Error(
          skillResult.error_string || "Failed to save skills to FloCareer"
        );
      }

      // Update skills with FloCareer IDs in local database
      if (skillResult.skill_matrix) {
        for (const skillData of skillResult.skill_matrix) {
          await fetch(`/api/skills/${skillData.ai_skill_id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${
                process.env.NEXT_PUBLIC_AUTH_TOKEN || ""
              }`,
            },
            body: JSON.stringify({ floCareerId: skillData.skill_id }),
          });
        }

        // Update local state with the new flocareer IDs
        setEditedSkills((prevSkills) =>
          prevSkills.map((skill) => {
            const skillData = skillResult.skill_matrix.find(
              (s: any) => s.ai_skill_id === skill.id
            );
            return skillData
              ? { ...skill, floCareerId: skillData.skill_id }
              : skill;
          })
        );
      }

      // Step 2: Save questions to FloCareer
      const flocareerQuestions = activeQuestions.map((question, index) => ({
        ai_question_id: `Q${String(index + 1).padStart(3, "0")}`, // Format as Q001, Q002, etc.
        question_type: "descriptive",
        candidate_description: "",
        title:
          question.question.length > 100
            ? question.question.substring(0, 100) + "..."
            : question.question,
        description: encodeURIComponent(
          `<h1>${question.question}</h1>\n<p>============================</p>\n`
        ),
        tags: Array.isArray(question.category)
          ? question.category
          : [question.category, question.questionFormat || "Scenario"].filter(
              Boolean
            ),
        ideal_answer: encodeURIComponent(`<p>${question.answer}</p>`),
        source: "genai_gpt-40",
      }));

      // Create a mapping to track original IDs
      const questionIdMapping = activeQuestions.map((question, index) => ({
        originalId: question.id,
        tempId: `Q${String(index + 1).padStart(3, "0")}`,
      }));

      const questionRequestBody = {
        user_id: record.userId,
        questions: flocareerQuestions,
      };
      console.log("questionRequestBody", questionRequestBody);
      const questionResponse = await fetch(
        "https://sandbox.flocareer.com/dynamic/corporate/create-question/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(questionRequestBody),
        }
      );
      console.log("questionResponse", questionResponse);

      if (!questionResponse.ok) {
        throw new Error(
          `FloCareer Questions API error: ${questionResponse.status}`
        );
      }

      const questionResult = await questionResponse.json();
      console.log("questionResult", questionResult);

      if (!questionResult.success) {
        throw new Error(
          questionResult.error_string || "Failed to save questions to FloCareer"
        );
      }

      // Update questions with FloCareer IDs in local database
      if (questionResult.questions) {
        for (const questionData of questionResult.questions) {
          if (questionData.success) {
            // Find the original ID using our mapping
            const mapping = questionIdMapping.find(
              (m) => m.tempId === questionData.ai_question_id
            );
            console.log("mapping", mapping);
            if (mapping) {
              await fetch(`/api/questions/${mapping.originalId}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${
                    process.env.NEXT_PUBLIC_AUTH_TOKEN || ""
                  }`,
                },
                body: JSON.stringify({ floCareerId: questionData.question_id }),
              });
            }
          }
        }

        // Update local state with the new flocareer IDs
        setQuestions((prevQuestions) =>
          prevQuestions.map((question) => {
            const mapping = questionIdMapping.find(
              (m) => m.originalId === question.id
            );
            if (!mapping) return question;

            const questionData = questionResult.questions.find(
              (q: any) => q.ai_question_id === mapping.tempId
            );
            return questionData && questionData.success
              ? { ...question, floCareerId: questionData.question_id }
              : question;
          })
        );
        console.log("questions", questions);
      }

      // Step 3: Create interview structure (if needed)
      // Get all questions that have been saved to FloCareer (only active questions for add/edit actions)
      const questionsWithFloId = questions.filter((q) => {
        if (q.deleted) return false; // Exclude deleted questions from add/edit actions

        const mapping = questionIdMapping.find((m) => m.originalId === q.id);
        if (!mapping) return false;

        const questionData = questionResult.questions?.find(
          (qr: any) => qr.ai_question_id === mapping.tempId
        );
        return questionData && questionData.success;
      });

      // Include deleted questions that have existing floCareerId for delete actions
      const deletedQuestionsWithExistingFloId = questions.filter(
        (q) => q.deleted && q.floCareerId && q.floCareerPoolId // Only include deleted questions that have a pool ID
      );

      // Combine all questions for the interview structure
      const allQuestionsForStructure = [
        ...questionsWithFloId,
        ...deletedQuestionsWithExistingFloId,
      ];

      if (allQuestionsForStructure.length > 0) {
        const questionPoolsList: Array<{
          pool_id: number;
          action: string;
          name: string;
          num_of_questions_to_ask: number;
          questions: number[];
        }> = [];

        for (const skill of editedSkills) {
          // Skip deleted skills as they will be handled separately
          if (skill.deleted) continue;

          const skillQuestions = allQuestionsForStructure.filter(
            (q) => q.skillId === skill.id
          );

          if (skillQuestions.length > 0) {
            // Separate active and deleted questions for this skill
            // For edit actions, we only include active questions (excluding deleted ones)
            const activeQuestions = skillQuestions.filter((q) => !q.deleted);
            const deletedQuestions = skillQuestions.filter((q) => q.deleted);

            // Handle active questions (non-deleted questions for add/edit actions)
            if (activeQuestions.length > 0) {
              // Group active questions by their floCareerPoolId
              const questionsByPool = new Map<number, number[]>();

              // Debug: Log active questions for this skill
              console.log(
                `Active questions for skill ${skill.name}:`,
                activeQuestions.map((q) => ({
                  id: q.id,
                  floCareerId: q.floCareerId,
                  floCareerPoolId: q.floCareerPoolId,
                  deleted: q.deleted,
                }))
              );

              // Debug: Log deleted questions that will be excluded from edit actions
              if (deletedQuestions.length > 0) {
                console.log(
                  `Deleted questions for skill ${skill.name} (will be excluded from edit actions):`,
                  deletedQuestions.map((q) => ({
                    id: q.id,
                    floCareerId: q.floCareerId,
                    floCareerPoolId: q.floCareerPoolId,
                    deleted: q.deleted,
                  }))
                );
              }

              for (const question of activeQuestions) {
                let questionId = null;

                // First try to get from the current submission
                const mapping = questionIdMapping.find(
                  (m) => m.originalId === question.id
                );
                if (mapping) {
                  const questionData = questionResult.questions.find(
                    (qr: any) => qr.ai_question_id === mapping.tempId
                  );
                  if (questionData?.question_id) {
                    questionId = questionData.question_id;
                  }
                }

                // If not found in current submission, use existing floCareerId
                if (!questionId) {
                  questionId = question.floCareerId || null;
                }

                if (questionId) {
                  // Use floCareerPoolId from question if it exists, otherwise use 0 for new questions
                  const poolId = question.floCareerPoolId || 0;
                  if (!questionsByPool.has(poolId)) {
                    questionsByPool.set(poolId, []);
                  }
                  questionsByPool.get(poolId)!.push(questionId);
                }
              }

              // Create pools for each unique pool_id
              for (const [poolId, questionIds] of questionsByPool) {
                // For edit actions, exclude deleted question IDs from the questions array
                const finalQuestionIds =
                  poolId === 0
                    ? questionIds // For new pools (add action), include all questions
                    : questionIds.filter((id) => {
                        // Find the question by ID and ensure it's not deleted
                        const question = activeQuestions.find((q) => {
                          const mapping = questionIdMapping.find(
                            (m) => m.originalId === q.id
                          );
                          if (mapping) {
                            const questionData = questionResult.questions.find(
                              (qr: any) => qr.ai_question_id === mapping.tempId
                            );
                            return questionData?.question_id === id;
                          }
                          return q.floCareerId === id;
                        });

                        // Ensure the question exists and is not deleted
                        const isValidQuestion = question && !question.deleted;

                        if (!isValidQuestion) {
                          console.log(
                            `Excluding deleted question ID ${id} from edit action for skill ${skill.name}`
                          );
                        }

                        return isValidQuestion;
                      });

                // Determine action based on poolId and number of active questions
                let action: string;
                if (poolId === 0) {
                  action = "add"; // New pool
                } else if (finalQuestionIds.length === 0) {
                  action = "delete"; // Existing pool with no active questions
                } else {
                  action = "edit"; // Existing pool with active questions
                }

                const pool = {
                  pool_id: poolId,
                  action: action,
                  name: skill.name,
                  num_of_questions_to_ask: finalQuestionIds.length,
                  questions: finalQuestionIds,
                };

                // Debug log to show what's being sent for each action
                console.log(`Pool for ${skill.name}:`, {
                  action,
                  poolId,
                  questionCount: finalQuestionIds.length,
                  questions: finalQuestionIds,
                  isEditAction: action === "edit",
                  isDeleteAction: action === "delete",
                  excludedQuestions:
                    action === "edit"
                      ? questionIds.filter(
                          (id) => !finalQuestionIds.includes(id)
                        )
                      : [],
                  totalQuestionsInPool: questionIds.length,
                  actionReason:
                    poolId === 0
                      ? "New pool (add)"
                      : finalQuestionIds.length === 0
                      ? "No active questions (delete)"
                      : "Has active questions (edit)",
                });

                questionPoolsList.push(pool);
              }
            }

            // Note: Deleted questions are now handled within the edit action by excluding their IDs from the questions array
            // No separate delete pools are created for individual deleted questions
          }
        }

        // Handle deleted skills and their questions
        // When a skill is deleted, ALL questions related to that skill should be marked for deletion
        for (const skill of editedSkills.filter((s) => s.deleted)) {
          // Get ALL questions for this deleted skill (both active and deleted)
          const allSkillQuestions = questions.filter(
            (q) => q.skillId === skill.id
          );

          if (allSkillQuestions.length > 0) {
            // Group ALL questions by their floCareerPoolId (both active and deleted)
            const questionsByPool = new Map<number, number[]>();

            for (const question of allSkillQuestions) {
              // For deleted skills, we want to delete ALL questions regardless of their deleted status
              if (question.floCareerId && question.floCareerPoolId) {
                const poolId = question.floCareerPoolId;
                if (!questionsByPool.has(poolId)) {
                  questionsByPool.set(poolId, []);
                }
                questionsByPool.get(poolId)!.push(question.floCareerId);
              }
            }

            // Create delete pools for each unique pool_id containing ALL questions for this skill
            for (const [poolId, questionIds] of questionsByPool) {
              const deletedPool = {
                pool_id: poolId, // Use floCareerPoolId for deletion
                action: "delete",
                name: skill.name,
                num_of_questions_to_ask: questionIds.length,
                questions: questionIds,
              };

              // Debug log for deleted skill pools
              console.log(`Deleted skill pool for ${skill.name}:`, {
                action: "delete",
                poolId,
                questionCount: questionIds.length,
                questions: questionIds,
                skillDeleted: true,
              });

              questionPoolsList.push(deletedPool);
            }
          }
        }

        // Add delete actions for deleted skills' pools (from deletedSkills array)
        // This handles skills that were deleted in previous sessions and need their pools deleted
        // const deletedSkillPools = deletedSkills
        //   .filter((skill) => skill.floCareerId) // Only include skills that have been saved to FloCareer
        //   .map((skill) => {
        //     // Check if we already have a delete pool for this skill from the questions
        //     const existingDeletePool = questionPoolsList.find(
        //       (pool) => pool.name === skill.name && pool.action === "delete"
        //     );

        //     // If we already have a delete pool for this skill, skip adding another one
        //     if (existingDeletePool) {
        //       console.log(
        //         `Skipping duplicate delete pool for skill ${skill.name} (pool_id: ${skill.floCareerId})`
        //       );
        //       return null;
        //     }

        //     return {
        //       pool_id: pool_id, // Use the actual FloCareer pool ID
        //       action: "delete",
        //       name: skill.name,
        //       num_of_questions_to_ask: 0,
        //       questions: [],
        //     };
        //   })
        //   .filter((pool): pool is NonNullable<typeof pool> => pool !== null); // Remove null entries with proper typing

        // Combine all pools (new/updated and deleted)
        // const allQuestionPools = [...questionPoolsList, ...deletedSkillPools];
        const allQuestionPools = [...questionPoolsList];

        if (allQuestionPools.length > 0) {
          // Log summary of what's being sent
          console.log("Interview structure summary:", {
            totalPools: allQuestionPools.length,
            pools: allQuestionPools.map((pool) => ({
              name: pool.name,
              action: pool.action,
              poolId: pool.pool_id,
              questionCount: pool.questions.length,
            })),
            deletedSkillsCount: editedSkills.filter((s) => s.deleted).length,
            deletedQuestionsCount: questions.filter((q) => q.deleted).length,
          });

          const structureRequestBody = {
            user_id: record.userId,
            round_id: record.roundId,
            question_pools: allQuestionPools,
          };

          console.log(
            "Interview structure request body:",
            structureRequestBody
          );

          // const structureResponse = await fetch(
          //   "https://sandbox.flocareer.com/dynamic/corporate/create-interview-structure/",
          //   {
          //     method: "POST",
          //     headers: {
          //       "Content-Type": "application/json",
          //     },
          //     body: JSON.stringify(structureRequestBody),
          //   }
          // );

          // if (structureResponse.ok) {
          //   const structureResult = await structureResponse.json();
          //   if (structureResult.success) {
          //     console.log("Interview structure created:", structureResult);

          //     // Process the response to update floCareerPoolId for questions
          //     if (
          //       structureResult.question_pools &&
          //       Array.isArray(structureResult.question_pools)
          //     ) {
          //       for (const pool of structureResult.question_pools) {
          //         if (pool.questions && Array.isArray(pool.questions)) {
          //           for (const questionData of pool.questions) {
          //             if (
          //               questionData.ai_question_id &&
          //               questionData.question_id
          //             ) {
          //               // Find the question by ai_question_id and update its floCareerPoolId
          //               const mapping = questionIdMapping.find(
          //                 (m) => m.tempId === questionData.ai_question_id
          //               );

          //               if (mapping) {
          //                 // Update the question in the database with the pool_id as floCareerPoolId
          //                 await fetch(`/api/questions/${mapping.originalId}`, {
          //                   method: "PATCH",
          //                   headers: {
          //                     "Content-Type": "application/json",
          //                     Authorization: `Bearer ${
          //                       process.env.NEXT_PUBLIC_AUTH_TOKEN || ""
          //                     }`,
          //                   },
          //                   body: JSON.stringify({
          //                     floCareerPoolId: pool.pool_id,
          //                     floCareerId: questionData.question_id,
          //                   }),
          //                 });

          //                 // Update local state
          //                 setQuestions((prevQuestions) =>
          //                   prevQuestions.map((question) =>
          //                     question.id === mapping.originalId
          //                       ? {
          //                           ...question,
          //                           floCareerPoolId: pool.pool_id,
          //                           floCareerId: questionData.question_id,
          //                         }
          //                       : question
          //                   )
          //                 );
          //               }
          //             }
          //           }
          //         }
          //       }
          //     }
          //   }
          // }

          const response = await fetch(
            `/api/records/${record.id}/create-interview-structure`,
            {
              method: "POST",
              // body: JSON.stringify(structureRequestBody),
            }
          );
        }
      }

      toast.success(
        "Successfully submitted all skills and questions to FloCareer!"
      );
      setFinalSubmitDialogOpen(false);

      // Clear deleted skills and questions after successful submission
      setDeletedSkills([]);
      setDeletedQuestions([]);
      setSessionDeletedSkills(new Set());
      setSessionDeletedQuestions(new Set());

      // Send success message to parent window
      try {
        const parentUrl = getQueryParam("parentUrl");
        console.log("parentUrl", parentUrl);
        if (parentUrl && window.parent) {
          window.parent.postMessage(
            {
              type: "iframeData",
              payload: {
                success: true,
                message: "FloCareer submission completed successfully",
              },
            },
            parentUrl
          );
          console.log("Success message sent to parent:", parentUrl);
        }
      } catch (error) {
        console.error("Error sending message to parent:", error);
      }
    } catch (error: any) {
      console.error("Error submitting to FloCareer:", error);
      toast.error(error.message || "Failed to submit to FloCareer");

      // Clear deleted tracking on error to prevent accumulation
      setDeletedSkills([]);
      setDeletedQuestions([]);
      setSessionDeletedSkills(new Set());
      setSessionDeletedQuestions(new Set());

      // Send error message to parent window
      try {
        const parentUrl = getQueryParam("parentUrl");
        console.log("parentUrl", parentUrl);
        if (parentUrl && window.parent) {
          window.parent.postMessage(
            {
              type: "iframeData",
              payload: {
                success: false,
                message: error.message || "FloCareer submission failed",
              },
            },
            parentUrl
          );
          console.log("Error message sent to parent:", parentUrl);
        }
      } catch (postMessageError) {
        console.error(
          "Error sending error message to parent:",
          postMessageError
        );
      }
    } finally {
      setSavingToFloCareer(false);
    }
  };

  return (
    <div className="space-y-6 w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">{record.jobTitle}</h1>
            <p className="text-muted-foreground">
              Created: {new Date(record.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleGenerateExcel}
            disabled={
              excelExporting ||
              questions.filter((q) => !q.deleted).length === 0 ||
              generatingQuestions ||
              questionsLoading
            }
            variant="outline"
          >
            {excelExporting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Preparing Excel...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Download Excel
              </>
            )}
          </Button>
          <Button
            onClick={handleGeneratePDF}
            disabled={
              pdfLoading ||
              questions.filter((q) => !q.deleted).length === 0 ||
              generatingQuestions ||
              questionsLoading
            }
          >
            {pdfLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Preparing PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex justify-between">
        {activeTab === "questions" && (
          <div className="flex items-center justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("skills")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Skills
            </Button>
          </div>
        )}

        {activeTab === "skills" && (
          <div className="flex items-center justify-end w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("questions")}
              className="mb-2"
            >
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="skills" className="flex-1 max-w-[200px]">
            Skills ({editedSkills.filter((skill) => !skill.deleted).length})
          </TabsTrigger>
          <TabsTrigger
            value="questions"
            className="flex-1 max-w-[200px]"
            onClick={() => {
              if (activeTab !== "questions") {
                fetchLatestQuestions();
              }
            }}
          >
            Questions ({questions.filter((q) => !q.deleted).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="pt-4">
          <Card className="w-full overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Skills Management</CardTitle>
                <CardDescription>
                  Edit skill levels, requirements, priorities, and question
                  formats. Mark skills as mandatory to include them in interview
                  questions.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* <Button
                  variant="default"
                  onClick={() => autoGenerateSkillsAndQuestions()}
                  disabled={generatingQuestions}
                  className="mr-2"
                >
                  {generatingQuestions ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Auto-Generating...
                    </>
                  ) : (
                    "Auto-Generate Questions"
                  )}
                </Button> */}
                <Button
                  variant={priorityMode ? "secondary" : "outline"}
                  onClick={() => setPriorityMode(!priorityMode)}
                >
                  {priorityMode ? "Exit Priority Mode" : "Prioritize Skills"}
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {editedSkills.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    No skills found for this job.
                  </p>
                  <SkillsTable
                    skills={[]}
                    recordId={record.id}
                    onUpdateSkill={updateSkill}
                    getSkillQuestionCount={getSkillQuestionCount}
                    onDeleteSkill={(skillId) => {
                      handleDeleteSkill(skillId);
                    }}
                    onBulkDeleteSkills={handleBulkDeleteSkills}
                    onSkillAdded={() => {
                      // Fetch the latest skills data from the server
                      fetch(`/api/records/${record.id}`, {
                        method: "GET",
                        headers: {
                          Authorization: `Bearer ${
                            process.env.NEXT_PUBLIC_AUTH_TOKEN || ""
                          }`,
                        },
                      })
                        .then((response) => response.json())
                        .then((data) => {
                          if (data.success && data.record) {
                            // Sort skills by priority
                            const sortedSkills = [...data.record.skills].sort(
                              (a, b) => {
                                // First sort by requirement type (MANDATORY first)
                                if (a.requirement !== b.requirement) {
                                  return a.requirement === "MANDATORY" ? -1 : 1;
                                }
                                // Then sort by priority
                                const aPriority = a.priority ?? 999;
                                const bPriority = b.priority ?? 999;
                                return aPriority - bPriority;
                              }
                            );

                            // Update the skills state
                            setEditedSkills(sortedSkills);
                            toast.success("Skill added successfully");
                          }
                        })
                        .catch((error) => {
                          console.error(
                            "Error fetching updated skills:",
                            error
                          );
                          toast.error("Failed to refresh skills");
                        });
                    }}
                    loading={loading}
                    onGenerateQuestionsForSkills={
                      generateQuestionsForSelectedSkills
                    }
                  />
                </div>
              ) : priorityMode ? (
                // Drag and drop priority mode
                <div className="space-y-4">
                  {/* Bulk operations controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isAllSelectedInPriorityMode}
                          onCheckedChange={handleSelectAllInPriorityMode}
                          {...(isIndeterminateInPriorityMode && {
                            "data-state": "indeterminate",
                          })}
                        />
                        <span className="text-sm">
                          Select All ({selectedSkillsInPriorityMode.size}{" "}
                          selected)
                        </span>
                      </div>
                      {selectedSkillsInPriorityMode.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBulkDeleteInPriorityMode}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Selected ({selectedSkillsInPriorityMode.size})
                        </Button>
                      )}
                    </div>
                  </div>

                  <DragDropContext onDragEnd={onDragEnd}>
                    <div className="space-y-6">
                      {mandatorySkills.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Badge variant="default">Mandatory Skills</Badge>
                            <span className="text-xs text-muted-foreground">
                              Drag to reorder - these skills will be prioritized
                              in question generation
                            </span>
                          </div>

                          <Droppable droppableId="mandatory-skills">
                            {(provided: any) => (
                              <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="space-y-2"
                              >
                                {mandatorySkills.map((skill, index) => (
                                  <Draggable
                                    key={skill.id}
                                    draggableId={skill.id}
                                    index={index}
                                  >
                                    {(provided: any) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className="flex items-center p-3 border rounded-md bg-muted/20"
                                      >
                                        <Checkbox
                                          checked={selectedSkillsInPriorityMode.has(
                                            skill.id
                                          )}
                                          onCheckedChange={(checked) =>
                                            handleSkillSelectInPriorityMode(
                                              skill.id,
                                              checked as boolean
                                            )
                                          }
                                          className="mr-3"
                                        />
                                        <div
                                          {...provided.dragHandleProps}
                                          className="cursor-grab mr-2"
                                        >
                                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium overflow-hidden break-words">
                                            {skill.name}
                                          </div>
                                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                                            <span>
                                              Level:{" "}
                                              {getLevelLabel(skill.level)}
                                            </span>
                                            <span>•</span>
                                            <span>
                                              Priority:{" "}
                                              {skill.priority || index + 1}
                                            </span>
                                            <span>•</span>
                                            <span>
                                              Questions:{" "}
                                              {getSkillNumQuestions(skill.id)}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="ml-2">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                              handleDeleteSkill(skill.id);
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      )}

                      {mandatorySkills.length > 0 &&
                        optionalSkills.length > 0 && (
                          <Separator className="my-6" />
                        )}

                      {optionalSkills.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Badge variant="outline">Optional Skills</Badge>
                            <span className="text-xs text-muted-foreground">
                              These skills will be used if time permits
                            </span>
                          </div>

                          <Droppable droppableId="optional-skills">
                            {(provided: any) => (
                              <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="space-y-2"
                              >
                                {optionalSkills.map((skill, index) => (
                                  <Draggable
                                    key={skill.id}
                                    draggableId={skill.id}
                                    index={index}
                                  >
                                    {(provided: any) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className="flex items-center p-3 border rounded-md"
                                      >
                                        <Checkbox
                                          checked={selectedSkillsInPriorityMode.has(
                                            skill.id
                                          )}
                                          onCheckedChange={(checked) =>
                                            handleSkillSelectInPriorityMode(
                                              skill.id,
                                              checked as boolean
                                            )
                                          }
                                          className="mr-3"
                                        />
                                        <div
                                          {...provided.dragHandleProps}
                                          className="cursor-grab mr-2"
                                        >
                                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium overflow-hidden break-words">
                                            {skill.name}
                                          </div>
                                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                                            <span>
                                              Level:{" "}
                                              {getLevelLabel(skill.level)}
                                            </span>
                                            <span>•</span>
                                            <span>
                                              Priority:{" "}
                                              {skill.priority || index + 1}
                                            </span>
                                            <span>•</span>
                                            <span>
                                              Questions:{" "}
                                              {getSkillNumQuestions(skill.id)}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="ml-2">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                              handleDeleteSkill(skill.id);
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      )}
                    </div>
                  </DragDropContext>
                </div>
              ) : (
                // TanStack table implementation
                <SkillsTable
                  skills={editedSkills.filter((skill) => !skill.deleted)}
                  recordId={record.id}
                  onUpdateSkill={updateSkill}
                  getSkillQuestionCount={getSkillQuestionCount}
                  onDeleteSkill={(skillId) => {
                    handleDeleteSkill(skillId);
                  }}
                  onBulkDeleteSkills={handleBulkDeleteSkills}
                  onSkillAdded={() => {
                    // Fetch the latest skills data from the server
                    fetch(`/api/records/${record.id}`, {
                      method: "GET",
                      headers: {
                        Authorization: `Bearer ${
                          process.env.NEXT_PUBLIC_AUTH_TOKEN || ""
                        }`,
                      },
                    })
                      .then((response) => response.json())
                      .then((data) => {
                        if (data.success && data.record) {
                          // Sort skills by priority
                          const sortedSkills = [...data.record.skills].sort(
                            (a, b) => {
                              // First sort by requirement type (MANDATORY first)
                              if (a.requirement !== b.requirement) {
                                return a.requirement === "MANDATORY" ? -1 : 1;
                              }
                              // Then sort by priority
                              const aPriority = a.priority ?? 999;
                              const bPriority = b.priority ?? 999;
                              return aPriority - bPriority;
                            }
                          );

                          // Update the skills state
                          setEditedSkills(sortedSkills);
                          toast.success("Skill added successfully");
                        }
                      })
                      .catch((error) => {
                        console.error("Error fetching updated skills:", error);
                        // Refresh the entire page as fallback
                        router.refresh();
                      });
                  }}
                  loading={loading}
                  onGenerateQuestionsForSkills={
                    generateQuestionsForSelectedSkills
                  }
                />
              )}
            </CardContent>

            <CardFooter className="flex justify-between">
              <div>
                <Button
                  onClick={() => setPriorityMode(!priorityMode)}
                  variant="outline"
                >
                  {priorityMode ? "Table View" : "Priority View"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="rounded-full h-8 w-8"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p>
                        Questions are generated for mandatory skills and
                        optional skills with question count &gt; 0. Select
                        "Generate Questions" to create questions for skills that
                        don't have any yet. Use "Regenerate All Questions" to
                        create new questions for all skills, replacing existing
                        ones.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  onClick={() => generateQuestionsForRecord(false)}
                  disabled={
                    generatingQuestions ||
                    regeneratingQuestions ||
                    questionsLoading ||
                    pdfLoading
                  }
                  variant="outline"
                >
                  {generatingQuestions ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Generating...
                    </>
                  ) : (
                    "Generate Questions"
                  )}
                </Button>
                <Button
                  onClick={regenerateAllQuestions}
                  disabled={
                    generatingQuestions ||
                    regeneratingQuestions ||
                    questionsLoading ||
                    pdfLoading ||
                    questions.filter((q) => !q.deleted).length === 0
                  }
                >
                  {regeneratingQuestions ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Regenerating...
                    </>
                  ) : (
                    "Regenerate All"
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Interview Questions</CardTitle>
                <CardDescription>
                  Generated questions for the mandatory skills
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {/* Show Save to FloCareer button only if reqId and userId exist */}
                {/* {record.reqId && record.userId && questions.length > 0 && (
                  <Button
                    onClick={saveQuestionsToFloCareer}
                    disabled={
                      savingToFloCareer ||
                      questionsLoading ||
                      generatingQuestions ||
                      pdfLoading
                    }
                    variant="default"
                    size="sm"
                  >
                    {savingToFloCareer ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Saving Questions...
                      </>
                    ) : (
                      "Save to FloCareer"
                    )}
                  </Button>
                )} */}
                {/* <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchLatestQuestions}
                  disabled={
                    questionsLoading || generatingQuestions || pdfLoading
                  }
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${
                      questionsLoading ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </Button> */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGlobalFeedbackDialogOpen(true)}
                  disabled={
                    questionsLoading ||
                    generatingQuestions ||
                    regeneratingQuestions ||
                    pdfLoading
                  }
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Global Feedback
                </Button>
                {hasDislikedQuestions() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regenerateAllDislikedQuestions}
                    disabled={
                      questionsLoading ||
                      generatingQuestions ||
                      regeneratingQuestions ||
                      pdfLoading
                    }
                  >
                    {questionsLoading ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Regenerate Disliked
                      </>
                    )}
                  </Button>
                )}
                {questions.filter((q) => !q.deleted).length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regenerateAllQuestions}
                    disabled={
                      questionsLoading ||
                      generatingQuestions ||
                      regeneratingQuestions ||
                      pdfLoading
                    }
                  >
                    {regeneratingQuestions ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Regenerating...
                      </>
                    ) : (
                      "Regenerate All"
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateExcel}
                  disabled={
                    excelExporting ||
                    questionsLoading ||
                    generatingQuestions ||
                    regeneratingQuestions
                  }
                >
                  {excelExporting ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Generating Excel...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Export Excel
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePDF}
                  disabled={
                    pdfLoading ||
                    questionsLoading ||
                    generatingQuestions ||
                    regeneratingQuestions
                  }
                >
                  {pdfLoading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {questionsLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Spinner size="lg" className="mb-4" />
                  <p className="text-muted-foreground">Loading questions...</p>
                </div>
              ) : questions.filter((q) => !q.deleted).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    No questions have been generated yet.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      onClick={() => generateQuestionsForRecord(false)}
                      disabled={
                        generatingQuestions ||
                        regeneratingQuestions ||
                        questionsLoading ||
                        pdfLoading
                      }
                      variant="outline"
                    >
                      {generatingQuestions ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Generating...
                        </>
                      ) : (
                        "Generate Questions"
                      )}
                    </Button>
                    <Button
                      onClick={regenerateAllQuestions}
                      disabled={
                        generatingQuestions ||
                        regeneratingQuestions ||
                        questionsLoading ||
                        pdfLoading
                      }
                    >
                      {regeneratingQuestions ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Regenerating...
                        </>
                      ) : (
                        "Regenerate All"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-md border relative overflow-x-auto"
                  style={{ width: "100%" }}
                >
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[10%]">Skill</TableHead>
                        <TableHead className="w-[8%]">Category</TableHead>
                        <TableHead className="w-[10%]">Format</TableHead>
                        <TableHead className="w-[8%]">Coding</TableHead>
                        <TableHead className="w-[42%]">Question</TableHead>
                        <TableHead className="w-[15%] text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedQuestions.map((question, index) => {
                        // Check if this is a new skill group
                        const isNewSkillGroup =
                          question.skillId !== currentSkillId;
                        // Update current skill
                        currentSkillId = question.skillId;

                        return (
                          <Fragment key={question.id}>
                            {isNewSkillGroup && (
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={6} className="py-2">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-semibold">
                                        {getSkillName(question.skillId)}
                                      </span>
                                      <span className="text-xs text-muted-foreground ml-2">
                                        (
                                        {getSkillNumQuestions(question.skillId)}{" "}
                                        questions requested,{" "}
                                        {getSkillDifficulty(question.skillId)}{" "}
                                        level)
                                      </span>
                                    </div>
                                    {/* {getSkillQuestionCount(question.skillId) > 0 && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="ml-2"
                                              onClick={() =>
                                                regenerateQuestionsFromSkill(question.skillId)
                                              }
                                            >
                                              <RefreshCw className="h-4 w-4 mr-2" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Regenerate all questions for {getSkillName(question.skillId)}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )} */}
                                    {getSkillQuestionCount(question.skillId) >
                                      0 && (
                                      <div className="flex items-center gap-2">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="ml-2"
                                                onClick={() =>
                                                  regenerateQuestionsFromSkill(
                                                    question.skillId
                                                  )
                                                }
                                              >
                                                <RefreshCw className="h-4 w-4 mr-2" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              Regenerate all questions for{" "}
                                              {getSkillName(question.skillId)}
                                            </TooltipContent>
                                          </Tooltip>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                                👍{" "}
                                                {
                                                  getSkillLikeStats(
                                                    question.skillId
                                                  ).liked
                                                }
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {
                                                getSkillLikeStats(
                                                  question.skillId
                                                ).liked
                                              }{" "}
                                              questions marked as helpful
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                                👎{" "}
                                                {
                                                  getSkillLikeStats(
                                                    question.skillId
                                                  ).disliked
                                                }
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {
                                                getSkillLikeStats(
                                                  question.skillId
                                                ).disliked
                                              }{" "}
                                              questions marked as not helpful
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow
                              className={cn(
                                "cursor-pointer hover:bg-muted/50",
                                question.liked === "LIKED" && "bg-green-50",
                                question.liked === "DISLIKED" && "bg-red-50"
                              )}
                            >
                              <TableCell>
                                {/* Add small indentation for grouped questions */}
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
                              {/* <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getDifficultyClass(
                                    question.difficulty
                                  )}`}
                                >
                                  {question.difficulty}
                                </span>
                              </TableCell> */}
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getQuestionFormatClass(
                                    question.questionFormat || "Scenario"
                                  )}`}
                                >
                                  {question.questionFormat || "Scenario"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                    question.coding
                                      ? "bg-blue-50 text-blue-800 border-blue-200"
                                      : "bg-gray-50 text-gray-800 border-gray-200"
                                  }`}
                                >
                                  {question.coding ? "Yes" : "No"}
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
                                    coding={question.coding}
                                    liked={question.liked}
                                    feedback={question.feedback}
                                    onStatusChange={(status) =>
                                      handleQuestionStatusChange(
                                        question.id,
                                        status
                                      )
                                    }
                                    onFeedbackChange={(feedback) =>
                                      handleQuestionFeedbackChange(
                                        question.id,
                                        feedback
                                      )
                                    }
                                    onRegenerateQuestion={
                                      handleRegenerateQuestion
                                    }
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      handleOpenFeedbackDialog(question.id)
                                    }
                                    className="h-8 w-8"
                                  >
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <MessageSquare
                                            className={cn(
                                              "h-4 w-4",
                                              question.feedback
                                                ? "text-blue-500"
                                                : "text-gray-400"
                                            )}
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {question.feedback
                                            ? "Edit feedback"
                                            : "Add feedback"}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      handleQuestionStatusChange(
                                        question.id,
                                        "LIKED"
                                      )
                                    }
                                    className={cn(
                                      "h-8 w-8",
                                      question.liked === "LIKED" &&
                                        "bg-green-100 text-green-800"
                                    )}
                                  >
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center">
                                            👍
                                          </div>
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
                                    onClick={() =>
                                      handleQuestionStatusChange(
                                        question.id,
                                        "DISLIKED"
                                      )
                                    }
                                    className={cn(
                                      "h-8 w-8",
                                      question.liked === "DISLIKED" &&
                                        "bg-red-100 text-red-800"
                                    )}
                                  >
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center">
                                            👎
                                          </div>
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
                                    onClick={() =>
                                      handleOpenDeleteQuestionDialog(question)
                                    }
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Trash2 className="h-4 w-4" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Delete question
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("skills")}>
                Back to Skills
              </Button>
              {/* Show Create Interview Structure button only if reqId and userId exist and questions have FloCareer IDs */}
              {/* {record.reqId &&
                record.userId &&
                questions.some((q) => q.floCareerId) && (
                  <Button
                    onClick={createInterviewStructure}
                    disabled={
                      creatingInterviewStructure ||
                      savingToFloCareer ||
                      questionsLoading ||
                      generatingQuestions ||
                      pdfLoading
                    }
                    variant="default"
                  >
                    {creatingInterviewStructure ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Creating Structure...
                      </>
                    ) : (
                      "Create Interview Structure"
                    )}
                  </Button>
                )} */}
              {/* Add final submit button for FloCareer integration */}
              {record.reqId && record.userId && (
                <Button
                  onClick={() => setFinalSubmitDialogOpen(true)}
                  disabled={
                    savingToFloCareer ||
                    questionsLoading ||
                    generatingQuestions ||
                    pdfLoading ||
                    editedSkills.filter((skill) => !skill.deleted).length ===
                      0 ||
                    questions.filter((q) => !q.deleted).length === 0
                  }
                  variant="default"
                >
                  {savingToFloCareer ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Submitting...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Global Feedback Dialog */}
      <GlobalFeedbackDialog
        open={globalFeedbackDialogOpen}
        onOpenChange={setGlobalFeedbackDialogOpen}
        recordId={record.id}
        existingFeedback={globalFeedback}
        onFeedbackSubmitted={() => {
          fetchGlobalFeedback();
          toast.success(
            "Global feedback saved. It will be used when regenerating questions."
          );
        }}
      />

      {/* Add the FeedbackDialog component */}
      <FeedbackDialog />

      {/* Question Generation Dialog */}
      <QuestionGenerationDialog
        open={questionGenerationDialogOpen}
        title={generationProgress.title}
        description={generationProgress.description}
        showProgress={generationProgress.showProgress}
        progressValue={generationProgress.progressValue}
        progressText={generationProgress.progressText}
      />

      {/* Bulk Delete Confirmation Dialog for Priority Mode */}
      <Dialog
        open={confirmBulkDeleteOpen}
        onOpenChange={setConfirmBulkDeleteOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the following{" "}
              {selectedSkillsInPriorityMode.size} skill
              {selectedSkillsInPriorityMode.size > 1 ? "s" : ""}? This action
              cannot be undone and will also remove all related questions.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="max-h-32 overflow-y-auto">
              <ul className="list-disc list-inside space-y-1">
                {getSelectedSkillNamesInPriorityMode().map((name, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmBulkDeleteOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDeleteInPriorityMode}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add the new dialog components */}
      <SkillRegenerationDialog />

      {/* Add the requirement change confirmation dialog */}
      <Dialog
        open={confirmRequirementChangeOpen}
        onOpenChange={setConfirmRequirementChangeOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Skill Requirement</DialogTitle>
            <DialogDescription>
              {pendingRequirementChange && (
                <>
                  The skill "{pendingRequirementChange.skillName}" has{" "}
                  {pendingRequirementChange.questionCount} question
                  {pendingRequirementChange.questionCount > 1 ? "s" : ""}{" "}
                  generated.
                  <br />
                  <br />
                  Do you want to delete these questions when changing from
                  Mandatory to Optional?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmRequirementChangeOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => confirmRequirementChange(false)}
              disabled={loading}
            >
              Keep Questions
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmRequirementChange(true)}
              disabled={loading}
            >
              Delete Questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Submit Confirmation Dialog */}
      <Dialog
        open={finalSubmitDialogOpen}
        onOpenChange={setFinalSubmitDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Final Submit to FloCareer</DialogTitle>
            <DialogDescription>
              This will submit all skills and questions to FloCareer sandbox and
              create the interview structure.
              <br />
              <br />
              <strong>Summary:</strong>
              <br />• {
                editedSkills.filter((skill) => !skill.deleted).length
              }{" "}
              skill
              {editedSkills.filter((skill) => !skill.deleted).length > 1
                ? "s"
                : ""}{" "}
              will be saved
              <br />• {questions.filter((q) => !q.deleted).length} question
              {questions.filter((q) => !q.deleted).length > 1 ? "s" : ""} will
              be saved
              <br />• Interview structure will be created automatically
              {(getTotalDeletedSkillsInSession() > 0 ||
                getTotalDeletedQuestionsInSession() > 0) && (
                <>
                  <br />
                  <br />
                  <strong>Current Session Deletions:</strong>
                  {getTotalDeletedSkillsInSession() > 0 && (
                    <>
                      <br />• {getTotalDeletedSkillsInSession()} skill
                      {getTotalDeletedSkillsInSession() > 1 ? "s" : ""} will be
                      deleted
                    </>
                  )}
                  {getTotalDeletedQuestionsInSession() > 0 && (
                    <>
                      <br />• {getTotalDeletedQuestionsInSession()} question
                      {getTotalDeletedQuestionsInSession() > 1 ? "s" : ""} will
                      be deleted
                    </>
                  )}
                </>
              )}
              <br />
              <br />
              Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFinalSubmitDialogOpen(false)}
              disabled={savingToFloCareer}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={finalSubmitToFloCareer}
              disabled={savingToFloCareer}
            >
              {savingToFloCareer ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Submitting...
                </>
              ) : (
                "Yes, Submit All"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Question Dialog */}
      <DeleteQuestionDialog
        open={deleteQuestionDialogOpen}
        onOpenChange={setDeleteQuestionDialogOpen}
        questionContent={
          questionToDelete ? JSON.parse(questionToDelete.content).question : ""
        }
        onDelete={handleDeleteQuestion}
        isLoading={deletingQuestion}
      />
    </div>
  );
}
