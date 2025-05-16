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
import { Download } from "lucide-react";
import PDFDoc from "./PDFDocument";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { SkillsDialog } from "./ui/skills-dialog";
import { useRouter } from "next/navigation";
import { SkillLevel, Requirement } from "@prisma/client";

// Form validation schema
const formSchema = z.object({
  jobRole: z.string().min(1, { message: "Job role is required" }),
  customInstructions: z.string().optional(),
  jobDescriptionFile: z.instanceof(File).optional(),
});

export interface SkillWithMetadata {
  name: string;
  level: SkillLevel;
  requirement: Requirement;
  numQuestions: number;
  difficulty?: string;
}

type FormValues = z.infer<typeof formSchema>;

export function JDQnaForm() {
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

  const router = useRouter();

  // Form setup
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobRole: "",
      customInstructions: "",
    },
  });

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
    if (!pdfContent) {
      alert("Please upload a job description PDF first");
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
          jobDescription: pdfContent,
          jobTitle: form.getValues().jobRole,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to extract skills");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to extract skills");
      }

      // Instead of opening dialog, navigate directly to the record page
      if (data.recordId) {
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
    if (!pdfContent || skills.length === 0) {
      alert("Please extract skills first");
      return;
    }

    setLoading(true);

    try {
      // Filter mandatory skills for question generation
      const mandatorySkills = skills
        .filter((skill) => skill.requirement === "MANDATORY")
        .map((skill) => skill.name);

      // Include all skills in the request for reference
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobRole: form.getValues().jobRole,
          jobDescription: pdfContent,
          skills: skills,
          recordId: recordId,
          customInstructions: `Focus on these specific skills: ${mandatorySkills.join(
            ", "
          )}. Consider the skill level (Beginner/Intermediate/Professional) when generating questions. ${
            form.getValues().customInstructions || ""
          }`,
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
            Upload a job description PDF and provide details to extract skills
            and generate interview questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
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

              <FormField
                control={form.control}
                name="jobDescriptionFile"
                render={({ field: { value, onChange, ...fieldProps } }) => (
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
                  <p className="text-sm text-muted-foreground">{fileName}</p>
                  <div className="mt-2 text-sm text-green-600">
                    <p>✓ PDF content extracted successfully!</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={extractingSkills || uploading || !pdfContent}
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
    </div>
  );
}
