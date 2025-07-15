"use client";
import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { QuestionsDisplay, Question } from "./ui/questions-display";
import { FileInput } from "./ui/file-input";
import { Spinner } from "./ui/spinner";
import { Download, FileText } from "lucide-react";
import PDFDoc from "./PDFDocument";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { useRouter } from "next/navigation";
import { SkillLevel, Requirement } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { QuestionGenerationDialog } from "./ui/question-generation-dialog";
import { toast } from "sonner";

// Form validation schema
const formSchema = z.object({
  jobRole: z.string().min(1, { message: "Job role is required" }),
  customInstructions: z.string().optional(),
  jobDescriptionFile: z.instanceof(File).optional(),
  jobDescriptionText: z.string().optional(),
  interviewLength: z.coerce
    .number()
    .min(15, { message: "Minimum interview length is 15 minutes" })
    .optional(),
  companyName: z.string().optional(),
});

export interface SkillWithMetadata {
  name: string;
  level: SkillLevel;
  requirement: Requirement;
  numQuestions: number;
  difficulty?: string;
  priority?: number;
}

type FormValues = z.infer<typeof formSchema>;

interface JobDetailsResponse {
  job_title: string;
  job_description: string;
  company_name: string;
  min_experience: number;
  max_experience: number;
  rounds: Array<{
    round_id: number;
    interview_type: string;
    skill_matrix: any[];
    question_pools: any[];
  }>;
}

interface JDQnaFormProps {
  reqId?: string;
  userId?: string;
}

export function JDQnaForm({ reqId, userId }: JDQnaFormProps) {
  // States
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extractingSkills, setExtractingSkills] = useState(false);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [skills, setSkills] = useState<SkillWithMetadata[]>([]);
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [inputMethod, setInputMethod] = useState<"file" | "text">("file");
  const [questionGenerationDialogOpen, setQuestionGenerationDialogOpen] =
    useState(false);
  const [generationProgress, setGenerationProgress] = useState({
    title: "Auto-Generating",
    description:
      "Creating skills and interview questions from your job description...",
    showProgress: true,
    progressValue: 0,
    progressText: "",
  });
  const [fetchingJobDetails, setFetchingJobDetails] = useState(false);

  const router = useRouter();

  // Form setup
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobRole: "",
      customInstructions: "",
      jobDescriptionText: "",
      interviewLength: 60, // Default to 60 minutes
      companyName: "",
    },
  });

  // Fetch job details if reqId and userId are provided
  useEffect(() => {
    const fetchJobDetails = async () => {
      if (reqId && userId) {
        setFetchingJobDetails(true);
        try {
          const response = await fetch(
            `https://sandbox.flocareer.com/dynamic/corporate/req-details/${reqId}/${userId}/`
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch job details: ${response.status}`);
          }

          const data: JobDetailsResponse = await response.json();

          // Pre-fill the form with the response data
          form.setValue("jobRole", data.job_title);
          form.setValue("companyName", data.company_name);

          // Extract HTML content and set as job description text
          const jobDescText = stripHtmlTags(data.job_description);
          form.setValue("jobDescriptionText", jobDescText);

          // Switch to text input method
          setInputMethod("text");

          // Calculate interview length based on experience (just an example calculation)
          const interviewLength = Math.min(90, 30 + data.max_experience * 5);
          form.setValue("interviewLength", interviewLength);

          toast.success("Job details loaded successfully");
        } catch (error) {
          console.error("Error fetching job details:", error);
          toast.error("Failed to fetch job details. Please try again.");
        } finally {
          setFetchingJobDetails(false);
        }
      }
    };

    fetchJobDetails();
  }, [reqId, userId, form]);

  // Helper function to strip HTML tags
  const stripHtmlTags = (html: string): string => {
    if (typeof window !== "undefined") {
      // Client-side parsing
      const doc = new DOMParser().parseFromString(html, "text/html");
      return doc.body.textContent || "";
    } else {
      // Simple server-side fallback using regex
      return html.replace(/<[^>]*>?/gm, "");
    }
  };

  // Handle file upload and content extraction
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setFileName(file.name);

    try {
      // Upload the file to get URL
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("File upload failed");
      }

      const {
        file: { url },
      } = await uploadResponse.json();

      // Extract content from the PDF
      const extractResponse = await fetch("/api/pdf-extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resumeUrl: url }),
      });

      if (!extractResponse.ok) {
        throw new Error("Failed to extract PDF content");
      }

      const { content } = await extractResponse.json();
      setPdfContent(content);
    } catch (error) {
      console.error("Error uploading or extracting file:", error);
      alert("Error uploading or processing file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Extract skills from job description
  const extractSkills = async () => {
    const jobDescription =
      inputMethod === "file" ? pdfContent : form.getValues().jobDescriptionText;

    if (!jobDescription) {
      alert("Please provide a job description first");
      return;
    }

    setExtractingSkills(true);

    try {
      const response = await fetch("/api/extract-skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobDescription: jobDescription,
          jobTitle: form.getValues().jobRole,
          interviewLength: Number(form.getValues().interviewLength),
          reqId: reqId,
          userId: userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to extract skills");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to extract skills");
      }

      // Set the recordId and open skills dialog instead of navigating
      if (data.recordId) {
        setRecordId(data.recordId);
        setSkills(data.analysis.skills || []);
        router.push(`/records/${data.recordId}`);
      } else {
        throw new Error("No record ID was returned from the API");
      }
    } catch (error) {
      console.error("Error extracting skills:", error);
      alert("Error extracting skills. Please try again.");
    } finally {
      setExtractingSkills(false);
    }
  };

  // Generate questions based on selected skills
  const generateQuestions = async () => {
    const jobDescription =
      inputMethod === "file" ? pdfContent : form.getValues().jobDescriptionText;

    if (!jobDescription || skills.length === 0) {
      alert("Please extract skills first");
      return;
    }

    setLoading(true);

    try {
      // Assign priorities to skills based on requirement and user's ordering
      const prioritizedSkills = [...skills].map((skill, index) => ({
        ...skill,
        priority: index + 1, // Default priority based on current order
      }));

      // Filter mandatory skills for question generation
      const mandatorySkills = prioritizedSkills
        .filter((skill) => skill.requirement === "MANDATORY")
        .map((skill) => skill.name);

      // Calculate total questions based on interview length
      const interviewLength = form.getValues().interviewLength || 60;
      const totalAvailableTime = interviewLength - 10; // Reserve 10 min for intro/wrap-up
      const avgTimePerQuestion = 4; // Average 4 minutes per question
      const maxQuestions = Math.floor(totalAvailableTime / avgTimePerQuestion);

      // Include all skills in the request for reference
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobRole: form.getValues().jobRole,
          jobDescription: jobDescription,
          skills: prioritizedSkills,
          recordId: recordId,
          interviewLength: Number(interviewLength),
          maxQuestions: maxQuestions,
          customInstructions: `Focus on these specific skills: ${mandatorySkills.join(
            ", "
          )}. Consider the skill level (Beginner/Intermediate/Professional) when generating questions. 
          Generate up to ${maxQuestions} questions in total, prioritizing mandatory skills. 
          ${form.getValues().customInstructions || ""}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate questions");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to generate questions");
      }

      setQuestions(data.questions);
      setSkillsDialogOpen(false);

      // If record was created, navigate to the record page to edit skills
      if (recordId) {
        router.push(`/records/${recordId}`);
      }
    } catch (error) {
      console.error("Error generating questions:", error);
      alert("Error generating questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Reset the form and start over
  const handleReset = () => {
    form.reset();
    setPdfContent(null);
    setQuestions([]);
    setFileName(null);
    setSkills([]);
  };

  // Generate and download PDF
  const handleGeneratePDF = async () => {
    if (!questions.length) return;

    setPdfLoading(true);
    try {
      const jobRole = form.getValues().jobRole;
      const fileName = `interview-questions-${jobRole
        .replace(/\s+/g, "-")
        .toLowerCase()}.pdf`;

      const blob = await pdf(
        <PDFDoc jobRole={jobRole} questions={questions as any} />
      ).toBlob();

      saveAs(blob, fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  // Watch for file changes
  const fileWatch = form.watch("jobDescriptionFile");

  // When file changes, upload it
  React.useEffect(() => {
    if (fileWatch && fileWatch instanceof File) {
      handleFileUpload(fileWatch);
    }
  }, [fileWatch]);

  // Auto-generate both skills and questions in one go
  const autoGenerateSkillsAndQuestions = async () => {
    const jobDescription =
      inputMethod === "file" ? pdfContent : form.getValues().jobDescriptionText;

    if (!form.getValues().jobRole) {
      alert("Please enter a job role first");
      return;
    }

    if (!jobDescription) {
      alert("Please provide a job description first");
      return;
    }

    setLoading(true);
    setQuestionGenerationDialogOpen(true);
    setGenerationProgress({
      title: "Auto-Generating Skills & Questions",
      description:
        "Analyzing your job description and creating comprehensive interview content...",
      showProgress: true,
      progressValue: 10,
      progressText: "Extracting skills from job description...",
    });

    try {
      const response = await fetch("/api/auto-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobRole: form.getValues().jobRole,
          jobDescription: jobDescription,
          interviewLength: Number(form.getValues().interviewLength || 60),
          customInstructions: form.getValues().customInstructions || "",
          reqId: reqId,
          userId: userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to auto-generate skills and questions");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to auto-generate");
      }

      if (data.recordId) {
        // Navigate directly to the record page
        router.push(`/records/${data.recordId}`);
      } else {
        throw new Error("No record ID was returned from the API");
      }
    } catch (error) {
      console.error("Error auto-generating:", error);
      alert("Error auto-generating skills and questions. Please try again.");
    } finally {
      setLoading(false);
      setQuestionGenerationDialogOpen(false);
    }
  };

  // Handle form submission - now extracts skills
  const onSubmit = (values: FormValues) => {
    extractSkills();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Job Description Details</CardTitle>
          <CardDescription>
            Upload a job description PDF or paste text to extract skills and
            generate interview questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchingJobDetails && (
            <div className="flex items-center justify-center p-4">
              <Spinner size="md" />
              <span className="ml-2">Loading job details...</span>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="jobRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Role</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Senior Frontend Developer"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interviewLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interview Length (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="15"
                        max="240"
                        placeholder="60"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Google" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Instructions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any specific focus areas or question types you'd like to include"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <Tabs
                  defaultValue="text"
                  value={inputMethod}
                  onValueChange={(value) =>
                    setInputMethod(value as "file" | "text")
                  }
                >
                  <TabsList className="grid grid-cols-2">
                    <TabsTrigger value="text">
                      Paste Job Description
                    </TabsTrigger>
                    <TabsTrigger value="file">Upload File</TabsTrigger>
                  </TabsList>

                  <TabsContent value="file">
                    <FormField
                      control={form.control}
                      name="jobDescriptionFile"
                      render={({
                        field: { value, onChange, ...fieldProps },
                      }) => (
                        <FormItem>
                          <FormLabel>Job Description PDF</FormLabel>
                          <FormControl>
                            <FileInput
                              accept=".pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  onChange(file);
                                }
                              }}
                              {...fieldProps}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {uploading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner size="sm" />
                        <span>Uploading and processing file...</span>
                      </div>
                    )}

                    {fileName && !uploading && pdfContent && (
                      <div className="border rounded-lg p-4">
                        <h3 className="font-medium mb-2">Uploaded PDF</h3>
                        <p className="text-sm text-muted-foreground">
                          {fileName}
                        </p>
                        <div className="mt-2 text-sm text-green-600">
                          <p>✓ PDF content extracted successfully!</p>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="text">
                    <FormField
                      control={form.control}
                      name="jobDescriptionText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Paste Job Description</FormLabel>
                          <FormControl>
                            <Textarea
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder="Paste your job description here..."
                              className="min-h-64 resize-y"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  type="button"
                  disabled={
                    loading ||
                    fetchingJobDetails ||
                    (inputMethod === "file"
                      ? uploading || !pdfContent
                      : !form.getValues().jobDescriptionText)
                  }
                  onClick={autoGenerateSkillsAndQuestions}
                >
                  {loading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Auto-Generating...
                    </>
                  ) : (
                    "Auto-Generate Questions"
                  )}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    extractingSkills ||
                    fetchingJobDetails ||
                    (inputMethod === "file"
                      ? uploading || !pdfContent
                      : !form.getValues().jobDescriptionText)
                  }
                >
                  {extractingSkills ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Extracting Skills...
                    </>
                  ) : (
                    "Extract Skills & Continue"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {questions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {form.getValues().jobRole} - Interview Questions
            </h2>
            <Button onClick={handleGeneratePDF} disabled={pdfLoading}>
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
          <QuestionsDisplay questions={questions} />
          <Button variant="outline" onClick={handleReset} className="mt-4">
            Start Over
          </Button>
        </div>
      )}

      {/* Question Generation Dialog */}
      <QuestionGenerationDialog
        open={questionGenerationDialogOpen}
        title={generationProgress.title}
        description={generationProgress.description}
        showProgress={generationProgress.showProgress}
        progressValue={generationProgress.progressValue}
        progressText={generationProgress.progressText}
      />
    </div>
  );
}
