"use client";

import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { Download, RefreshCw, ArrowLeft, Info } from "lucide-react";
import PDFDoc from "./PDFDocument";
import { Question as PDFQuestion } from "./ui/questions-display";
import { toast } from "sonner";

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

// Define interfaces for the types from Prisma
interface Skill {
  id: string;
  name: string;
  level: "BEGINNER" | "INTERMEDIATE" | "PROFESSIONAL";
  requirement: "MANDATORY" | "OPTIONAL";
  numQuestions: number;
  difficulty?: string;
  recordId: string;
}

interface Question {
  id: string;
  content: string;
  skillId: string;
  recordId: string;
  skill?: Skill;
}

interface SkillRecord {
  id: string;
  jobTitle: string;
  createdAt: Date;
  updatedAt: Date;
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
}

interface SkillRecordEditorProps {
  record: RecordWithRelations;
}

export default function SkillRecordEditor({ record }: SkillRecordEditorProps) {
  const router = useRouter();
  const [editedSkills, setEditedSkills] = useState<Skill[]>(record.skills);
  const [questions, setQuestions] = useState<QuestionData[]>(
    formatQuestions(record.questions)
  );
  const [loading, setLoading] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("skills");
  const [questionsLoading, setQuestionsLoading] = useState(false);

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
    field: "level" | "requirement" | "numQuestions" | "difficulty",
    value: string | number
  ) => {
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

  // Generate questions for skills without questions - modified to switch tabs and show toast
  const generateMissingQuestions = async () => {
    // Check if there are mandatory skills
    const mandatorySkills = editedSkills.filter(
      (skill) => skill.requirement === "MANDATORY"
    );

    if (mandatorySkills.length === 0) {
      toast.warning("Please mark some skills as mandatory first");
      return;
    }

    try {
      setGeneratingQuestions(true);
      toast.loading("Generating questions for mandatory skills...");

      // Find skills that need questions (mandatory skills with no questions)
      const skillsNeedingQuestions = editedSkills.filter(
        (skill) =>
          skill.requirement === "MANDATORY" &&
          !questions.some((q) => q.skillId === skill.id)
      );

      if (skillsNeedingQuestions.length === 0) {
        toast.info("All mandatory skills already have questions!");
        setGeneratingQuestions(false);
        return;
      }

      const response = await fetch("/api/generate-skill-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordId: record.id,
          skillIds: skillsNeedingQuestions.map((s) => s.id),
          // Include the skills with their metadata for batch processing
          skills: skillsNeedingQuestions.map((s) => ({
            id: s.id,
            numQuestions: s.numQuestions || 1,
            difficulty: s.difficulty || "Medium",
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate questions");
      }

      const data = await response.json();

      if (data.success) {
        // Show success toast
        toast.success(
          `Generated questions for ${skillsNeedingQuestions.length} skills!`
        );

        // Fetch the latest questions directly
        await fetchLatestQuestions();

        // Switch to questions tab
        setActiveTab("questions");
      } else {
        throw new Error(data.error || "Failed to generate questions");
      }
    } catch (error: any) {
      console.error("Error generating questions:", error);
      toast.error(error.message || "Error generating questions");
    } finally {
      setGeneratingQuestions(false);
    }
  };

  // Generate questions using the API endpoint for the record
  const generateQuestionsForRecord = async () => {
    try {
      setGeneratingQuestions(true);
      toast.loading("Generating questions for all mandatory skills...");

      const response = await fetch(
        `/api/records/${record.id}/generate-questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate questions");
      }

      const data = await response.json();

      if (data.success) {
        // Show success toast
        toast.success(`${data.message}`);

        // Fetch the latest questions directly
        await fetchLatestQuestions();

        // Switch to questions tab
        setActiveTab("questions");
      } else {
        throw new Error(data.error || "Failed to generate questions");
      }
    } catch (error: any) {
      console.error("Error generating questions:", error);
      toast.error(error.message || "Error generating questions");
    } finally {
      setGeneratingQuestions(false);
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

  // Generate and download PDF
  const handleGeneratePDF = async () => {
    if (!questions.length) {
      toast.warning("No questions available to include in PDF");
      return;
    }

    setPdfLoading(true);
    toast.loading("Preparing PDF...");

    try {
      const fileName = `interview-questions-${record.jobTitle
        .replace(/\s+/g, "-")
        .toLowerCase()}.pdf`;

      // Convert to the format expected by PDFDoc with correct typing
      const formattedQuestions: PDFQuestion[] = questions.map((q) => ({
        question: q.question,
        answer: q.answer,
        category: q.category as PDFQuestion["category"],
        difficulty: q.difficulty as PDFQuestion["difficulty"],
      }));

      const blob = await pdf(
        <PDFDoc jobRole={record.jobTitle} questions={formattedQuestions} />
      ).toBlob();

      saveAs(blob, fileName);
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error generating PDF. Please try again.");
    } finally {
      setPdfLoading(false);
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

  // Get requirement label
  const getRequirementLabel = (requirement: string) => {
    return requirement === "MANDATORY" ? "Mandatory" : "Optional";
  };

  // Count questions for each skill
  const getSkillQuestionCount = (skillId: string) => {
    return questions.filter((q) => q.skillId === skillId).length;
  };

  // View answer in a toast popup
  const viewAnswer = (question: QuestionData) => {
    toast(
      <div className="max-w-md">
        <h3 className="text-lg font-semibold mb-2">{question.question}</h3>
        <p className="text-sm">{question.answer}</p>
      </div>,
      {
        duration: 10000,
        position: "bottom-center",
        className: "w-[36rem] max-w-full",
      }
    );
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
    return skill?.difficulty || "Medium";
  };

  // First add a helper function to get a CSS class based on difficulty
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

  // Add a helper function to get a CSS class based on category
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

  // Sort questions by skillId then by difficulty
  const sortedQuestions = [...questions].sort((a, b) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
          </Button>
          <h1 className="text-2xl font-bold">{record.jobTitle}</h1>
          <p className="text-muted-foreground">
            Created: {new Date(record.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Button
          onClick={handleGeneratePDF}
          disabled={pdfLoading || questions.length === 0}
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="skills" className="flex-1 max-w-[200px]">
            Skills ({editedSkills.length})
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
            Questions ({questions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Skills Management</CardTitle>
              <CardDescription>
                Edit skill levels and requirements. Mark skills as mandatory to
                include them in interview questions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {editedSkills.length === 0 ? (
                <p className="text-muted-foreground">
                  No skills found for this job.
                </p>
              ) : (
                <div
                  className="rounded-md border relative overflow-x-auto"
                  style={{ width: "100%" }}
                >
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%]">Skill Name</TableHead>
                        <TableHead className="w-[15%]">Level</TableHead>
                        <TableHead className="w-[15%]">Requirement</TableHead>
                        <TableHead className="w-[15%]">Questions</TableHead>
                        <TableHead className="w-[15%]">Num. of Qs</TableHead>
                        <TableHead className="w-[10%]">Difficulty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editedSkills.map((skill) => (
                        <TableRow key={skill.id}>
                          <TableCell className="font-medium">
                            {skill.name}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={skill.level}
                              onValueChange={(value) =>
                                updateSkill(skill.id, "level", value)
                              }
                              disabled={loading}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select level" />
                              </SelectTrigger>
                              <SelectContent className="min-w-[160px] z-[100]">
                                <SelectItem value="BEGINNER">
                                  Beginner
                                </SelectItem>
                                <SelectItem value="INTERMEDIATE">
                                  Intermediate
                                </SelectItem>
                                <SelectItem value="PROFESSIONAL">
                                  Professional
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={skill.requirement}
                              onValueChange={(value) =>
                                updateSkill(skill.id, "requirement", value)
                              }
                              disabled={loading}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Requirement" />
                              </SelectTrigger>
                              <SelectContent className="min-w-[160px] z-[100]">
                                <SelectItem value="MANDATORY">
                                  Mandatory
                                </SelectItem>
                                <SelectItem value="OPTIONAL">
                                  Optional
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{getSkillQuestionCount(skill.id)}</span>
                              {getSkillQuestionCount(skill.id) > 0 && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                  Generated
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={skill.numQuestions || 1}
                              onChange={(e) =>
                                updateSkill(
                                  skill.id,
                                  "numQuestions",
                                  Math.min(
                                    10,
                                    Math.max(1, parseInt(e.target.value) || 1)
                                  )
                                )
                              }
                              className="w-full p-2 border rounded"
                              disabled={loading}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={skill.difficulty || "Medium"}
                              onValueChange={(value) =>
                                updateSkill(skill.id, "difficulty", value)
                              }
                              disabled={loading}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Difficulty" />
                              </SelectTrigger>
                              <SelectContent className="min-w-[160px] z-[100]">
                                <SelectItem value="Easy">Easy</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Hard">Hard</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={generateQuestionsForRecord}
                      disabled={generatingQuestions}
                    >
                      {generatingQuestions ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Generating Questions...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Generate Questions for Mandatory Skills
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>
                      Questions are generated in batches of 5 at a time to
                      reduce latency. Each skill will get the number of
                      questions specified in the "Num. of Qs" column.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="outline"
                onClick={() => setActiveTab("questions")}
                disabled={questions.length === 0}
              >
                View Questions
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Interview Questions</CardTitle>
                <CardDescription>
                  Questions generated based on the mandatory skills for this
                  job.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchLatestQuestions}
                disabled={questionsLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    questionsLoading ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </CardHeader>
            <CardContent>
              {questionsLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Spinner size="lg" className="mb-4" />
                  <p className="text-muted-foreground">Loading questions...</p>
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    No questions have been generated yet.
                  </p>
                  <Button
                    onClick={generateQuestionsForRecord}
                    disabled={generatingQuestions}
                  >
                    {generatingQuestions ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Generating Questions...
                      </>
                    ) : (
                      "Generate Questions"
                    )}
                  </Button>
                </div>
              ) : (
                <div
                  className="rounded-md border relative overflow-x-auto"
                  style={{ width: "100%" }}
                >
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[18%]">Skill</TableHead>
                        <TableHead className="w-[12%]">Category</TableHead>
                        <TableHead className="w-[12%]">Difficulty</TableHead>
                        <TableHead className="w-[48%]">Question</TableHead>
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
                                <TableCell colSpan={5} className="py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">
                                      {getSkillName(question.skillId)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({getSkillNumQuestions(question.skillId)}{" "}
                                      questions requested,{" "}
                                      {getSkillDifficulty(question.skillId)}{" "}
                                      difficulty)
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => viewAnswer(question)}
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
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getDifficultyClass(
                                    question.difficulty
                                  )}`}
                                >
                                  {question.difficulty}
                                </span>
                              </TableCell>
                              <TableCell className="font-medium">
                                {question.question}
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
              <Button
                onClick={handleGeneratePDF}
                disabled={pdfLoading || questions.length === 0}
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
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
