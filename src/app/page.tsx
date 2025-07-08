"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ChevronRight, Plus, Check, Loader2, Trash2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { any } from "zod";
import Link from "next/link";

interface Skill {
  skill_id: number;
  action: string;
  name: string;
  level: string;
  requirement: string;
  priority: number;
}

interface SkillMatrix {
  round_id: number;
  user_id: number;
  skill_matrix: Skill[];
}

interface Question {
  sl_no: number;
  question_title: string;
  question_description: string;
  candidate_description: string;
  candidate_facing_doc_url: string;
  tags: string;
  ideal_answer: string;
  coding: string;
  mandatory: string;
  hide_in_floreport: string;
  skill: string;
  pool_name: string;
}

interface QuestionResponse {
  round_id: number;
  user_id: number;
  total_questions: number;
  questions: Question[];
}

interface CreateSkillResponse {
  success: boolean;
  error_string: string;
}

interface CreateQuestionResponse {
  success: boolean;
  question_id: number;
  error_string: string;
}

// Add new interface for job details
interface JobDetails {
  job_title: string;
  job_description: string;
  company_name: string;
  min_experience: number;
  max_experience: number;
  rounds: Array<{
    roundId: number;
    interview_type: string;
    skill_matrix: any[];
    question_pools: any[];
  }>;
}

export default function SkillQuestion() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roundId, setRoundId] = useState("");
  const [userId, setUserId] = useState("");
  const [skillsData, setSkillsData] = useState<SkillMatrix | null>(null);
  const [questionsData, setQuestionsData] = useState<QuestionResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "skills" | "questions" | "job-details">("form");

  // Add state for job details
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [loadingJobDetails, setLoadingJobDetails] = useState(false);

  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  // For batch creation of skills
  const [creatingBatchSkills, setCreatingBatchSkills] = useState(false);
  const [skillsCreationProgress, setSkillsCreationProgress] = useState(0);
  const [createdSkills, setCreatedSkills] = useState<Skill[]>([]);
  const [skillCreationResults, setSkillCreationResults] = useState<{success: number, failed: number}>({success: 0, failed: 0});
  const [skillResponsesDialogOpen, setSkillResponsesDialogOpen] = useState(false);
  const [skillResponses, setSkillResponses] = useState<Array<{skill: Skill, response: any}>>([]);
  const [skillLength, setSkillLength] = useState(0);
  const [lastPriority, setLastPriority] = useState(0);
  // For adding new skills
  const [addSkillDialogOpen, setAddSkillDialogOpen] = useState(false);
  const [newSkill, setNewSkill] = useState<Skill>({
    skill_id: skillLength + 1,
    action: "add",
    name: "",
    level: "Intermediate",
    requirement: "Must-have",
    priority: lastPriority + 1
  });

  // For modified skills
  const [modifiedSkills, setModifiedSkills] = useState<Skill[]>([]);

  // For batch creation of questions
  const [creatingBatchQuestions, setCreatingBatchQuestions] = useState(false);
  const [questionCreationProgress, setQuestionCreationProgress] = useState(0);
  const [createdQuestionIds, setCreatedQuestionIds] = useState<number[]>([]);
  const [questionCreationResults, setQuestionCreationResults] = useState<{success: number, failed: number}>({success: 0, failed: 0});
  const [questionResponsesDialogOpen, setQuestionResponsesDialogOpen] = useState(false);
  const [questionResponses, setQuestionResponses] = useState<Array<{question: any, response: any}>>([]);
  

  // Track if form was pre-filled from URL
  const [wasPreFilled, setWasPreFilled] = useState(false);
  
  // Effect to pre-fill form from URL query parameters
  useEffect(() => {
    const reqId = searchParams.get("req_id");
    const uid = searchParams.get("user_id");
    
    if (reqId && uid) {
      setRoundId(reqId);
      setUserId(uid);
      setWasPreFilled(true);
    } else if (reqId) {
      setRoundId(reqId);
    } else if (uid) {
      setUserId(uid);
    }
  }, [searchParams]);
  
  // Effect to extract skills when pre-filled from URL
  // useEffect(() => {
  //   // Only run extraction if pre-filled from URL
  //   if (wasPreFilled && roundId && userId) {
  //     const timer = setTimeout(() => {
  //       extractSkills();
  //       fetchJobDetails();
  //       generateQuestions();
  //       setWasPreFilled(false); // Reset flag after extraction
  //     }, 300);
  //     return () => clearTimeout(timer);
  //   }
  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [wasPreFilled, roundId, userId]);

  // Function to fetch job details
  const fetchJobDetails = async () => {
    if (!roundId || !userId) {
      toast.error("Please enter both Round ID and User ID");
      return;
    }

    setLoadingJobDetails(true);
    toast.info("Fetching job details...");
    try {
      const response = await fetch(
        `https://sandbox.flocareer.com/dynamic/corporate/req-details/${roundId}/${userId}`
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

             const data = await response.json();
       setJobDetails(data);
       setActiveTab("job-details");
       toast.success("Job details fetched successfully");
    } catch (error) {
      console.error("Error fetching job details:", error);
      toast.error("Failed to fetch job details");
    } finally {
      setLoadingJobDetails(false);
    }
  };

  const extractSkills = async () => {
    if (!roundId || !userId) {
      toast.error("Please enter both Round ID and User ID");
      return;
    }

    setLoading1(true);
    toast.info("Extracting skills...");
    try {
      const response = await fetch(
        `https://flo-career-api-idrgy.ondigitalocean.app/dynamic/corporate/extract-skills/${roundId}/${userId}`
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setSkillsData(data);
      setActiveTab("skills");
      setSkillLength(data.skill_matrix.length);
      toast.success("Skills extracted successfully");
      setLastPriority(data.skill_matrix[data.skill_matrix.length - 1].priority);
      setNewSkill({
        skill_id: data.skill_matrix[data.skill_matrix.length - 1].skill_id + 1,
        action: "add",
        name: "",
        level: "Intermediate",
        requirement: "Must-have",
        priority: data.skill_matrix[data.skill_matrix.length - 1].priority + 1
      });
    } catch (error) {
      console.error("Error extracting skills:", error);
      toast.error("Failed to extract skills");
    } finally {
      setLoading1(false);
    }
  };

  const generateQuestions = async () => {
    if (!roundId || !userId) {
      toast.error("Please enter both Round ID and User ID");
      return;
    }

    setLoading2(true);
    toast.info("Generating questions...");
    try {
      const response = await fetch(
        `https://flo-career-api-idrgy.ondigitalocean.app/dynamic/corporate/generate-questions/${roundId}/${userId}`
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setQuestionsData(data);
      setActiveTab("questions");
      toast.success("Questions generated successfully");
    } catch (error) {
      console.error("Error generating questions:", error);
      toast.error("Failed to generate questions");
    } finally {
      setLoading2(false);
    }
  };

  // Function to create all skills one by one
  const createAllSkills = async () => {
    if (!skillsData || !skillsData.skill_matrix.length) {
      toast.error("No skills to create");
      return;
    }

    setCreatingBatchSkills(true);
    setSkillCreationResults({ success: 0, failed: 0 });
    setSkillsCreationProgress(0);
    setSkillResponses([]);

    const skills = skillsData.skill_matrix;
    const totalSkills = skills.length;
    const successfulSkills: Skill[] = [];
    const responses: Array<{skill: Skill, response: any}> = [];
    
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      
      try {
        // Update progress
        setSkillsCreationProgress(Math.round(((i) / totalSkills) * 100));
        
        const payload = {
          round_id: parseInt(roundId),
          user_id: parseInt(userId),
          skill_matrix: [
            {
              skill_id: 0,
              action: "add",
              name: skill.name,
              level: skill.level,
              requirement: skill.requirement,
            },
          ],
        };

        // API call to create skill
        const response = await fetch("https://sandbox.flocareer.com/dynamic/corporate/create-skills/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        responses.push({ skill, response: data });
        
        if (data.success) {
          successCount++;
          successfulSkills.push(skill);
          // Don't show toast for each success to avoid flooding
        } else {
          failedCount++;
          console.error(`Failed to create skill: ${skill.name}`, data.error_string);
        }
      } catch (error) {
        failedCount++;
        console.error(`Error creating skill: ${skill.name}`, error);
        responses.push({ skill, response: { success: false, error_string: "API call failed" } });
      }
    }
    
    // Set final progress
    setSkillsCreationProgress(100);
    
    // Update results
    setSkillCreationResults({
      success: successCount,
      failed: failedCount
    });
    
    // Set created skills
    setCreatedSkills([...createdSkills, ...successfulSkills]);
    
    // Set responses for view
    setSkillResponses(responses);
    
    // Show final toast
    if (successCount > 0) {
      toast.success(`Successfully created ${successCount} skills`);
    }
    if (failedCount > 0) {
      toast.error(`Failed to create ${failedCount} skills`);
    }

    setCreatingBatchSkills(false);
    setSkillResponsesDialogOpen(true);
  };

  // Function to create all questions one by one
  const createAllQuestions = async () => {
    if (!questionsData || !questionsData.questions.length) {
      toast.error("No questions to create");
      return;
    }

    setCreatingBatchQuestions(true);
    setQuestionCreationProgress(0);
    setQuestionCreationResults({ success: 0, failed: 0 });
    setQuestionResponses([]);

    const questions = questionsData.questions;
    const totalQuestions = questions.length;
    const successfulQuestionIds: number[] = [];
    const responses: Array<{question: any, response: any}> = [];
    
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      try {
        // Update progress
        setQuestionCreationProgress(Math.round(((i) / totalQuestions) * 100));
        
        // Format tags into an array
        const tagsArray = question.tags.split(', ').filter(Boolean);

        const payload = {
          user_id: parseInt(userId),
          question_type: question.coding === "Yes" ? "coding" : "descriptive",
          candidate_description: question.candidate_description,
          title: question.question_title,
          description: encodeURIComponent(question.question_description),
          tags: tagsArray,
          ideal_answer: encodeURIComponent(question.ideal_answer),
          source: "api_import"
        };

        // API call to create question
        const response = await fetch("https://sandbox.flocareer.com/dynamic/corporate/create-question/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        responses.push({ question, response: data });
        
        if (data.success) {
          successCount++;
          if (data.question_id) {
            successfulQuestionIds.push(data.question_id);
          }
          // Don't show toast for each success to avoid flooding
        } else {
          failedCount++;
          console.error(`Failed to create question: ${question.question_title}`, data.error_string);
        }
      } catch (error) {
        failedCount++;
        console.error(`Error creating question: ${question.question_title}`, error);
        responses.push({ question, response: { success: false, error_string: "API call failed" } });
      }
    }
    
    // Set final progress
    setQuestionCreationProgress(100);
    
    // Update results
    setQuestionCreationResults({
      success: successCount,
      failed: failedCount
    });
    
    // Set created question IDs
    setCreatedQuestionIds([...createdQuestionIds, ...successfulQuestionIds]);
    
    // Set responses for view
    setQuestionResponses(responses);
    
    // Show final toast
    if (successCount > 0) {
      toast.success(`Successfully created ${successCount} questions`);
    }
    if (failedCount > 0) {
      toast.error(`Failed to create ${failedCount} questions`);
    }

    setCreatingBatchQuestions(false);
    setQuestionResponsesDialogOpen(true);
  };

  // Navigate to the result page with question details
  const viewQuestionDetails = (question: Question) => {
    const questionData = encodeURIComponent(JSON.stringify(question));
    router.push(`/result?data=${questionData}`);
  };

  // Helper function to get the requirement badge class
  const getRequirementClass = (requirement: string) => {
    return requirement === "Must-have" 
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : "bg-gray-100 text-gray-800 border-gray-200";
  };

  // Helper function to get the level class
  const getLevelClass = (level: string) => {
    switch (level) {
      case "Professional":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Intermediate":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "Beginner":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Helper function to get the coding badge class
  const getCodingClass = (coding: string) => {
    return coding === "Yes" 
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-gray-100 text-gray-800 border-gray-200";
  };

  // Function to add a new skill
  const handleAddSkill = () => {
    if (!newSkill.name) {
      toast.error("Skill name is required");
      return;
    }

    if (!skillsData) {
      // Create new skills data if it doesn't exist
      setSkillsData({
        round_id: parseInt(roundId),
        user_id: parseInt(userId),
        skill_matrix: [newSkill]
      });
    } else {
      // Add to existing skills data
      setSkillsData({
        ...skillsData,
        skill_matrix: [...skillsData.skill_matrix, newSkill]
      });
    }

    // Add to modified skills for tracking changes
    setModifiedSkills([...modifiedSkills, newSkill]);

    setAddSkillDialogOpen(false);
    toast.success("Skill added successfully");

    // Reset new skill form
    setNewSkill({
      skill_id: skillLength + 1,
      action: "add",
      name: "",
      level: "Intermediate",
      requirement: "Must-have",
      priority: lastPriority + 1
    });
  };

  // Function to delete a skill
  const handleDeleteSkill = (skillToDelete: Skill) => {
    if (!skillsData) return;

    // Remove from skills data
    const updatedSkills = skillsData.skill_matrix.filter(
      skill => !(skill.name === skillToDelete.name && skill.level === skillToDelete.level)
    );

    setSkillsData({
      ...skillsData,
      skill_matrix: updatedSkills
    });

    // Add to modified skills with delete action
    const deleteAction = {
      ...skillToDelete,
      action: "delete"
    };
    setModifiedSkills([...modifiedSkills, deleteAction]);

    toast.success("Skill removed");
  };

  // Function to post modified skills
  const postModifiedSkills = async () => {
    if (modifiedSkills.length === 0) {
      toast.info("No changes to save");
      return;
    }

    setCreatingBatchSkills(true);
    try {
      const payload = {
        round_id: parseInt(roundId),
        user_id: parseInt(userId),
        skill_matrix: modifiedSkills,
      };

      // API call to update skills
      const response = await fetch("https://sandbox.flocareer.com/dynamic/corporate/create-skills/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success("Skills updated successfully");
        setModifiedSkills([]); // Clear modified skills after successful update
      } else {
        toast.error(`Failed to update skills: ${data.error_string}`);
      }
    } catch (error) {
      console.error("Error updating skills:", error);
      toast.error("Failed to update skills");
    } finally {
      setCreatingBatchSkills(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-row items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Skill Question Generator</h1>
        <Link href="/generate-skill-question">
          <Button variant="outline" size="sm">
          Go to JD Q&A Generator <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="w-full justify-start mb-4">
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="job-details" disabled={!jobDetails}>
            Job Details
          </TabsTrigger>
          <TabsTrigger value="skills" disabled={!skillsData && createdSkills.length === 0}>
            Skills {skillsData ? `(${skillsData.skill_matrix.length})` : createdSkills.length > 0 ? `(${createdSkills.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="questions" disabled={!questionsData && createdQuestionIds.length === 0}>
            Questions {questionsData ? `(${questionsData.total_questions})` : createdQuestionIds.length > 0 ? `(${createdQuestionIds.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form">
          <Card>
            <CardHeader>
              <CardTitle>Round & User Information</CardTitle>
              <CardDescription>
                Enter the round and user information to extract skills or generate questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roundId">Round ID</Label>
                  <Input
                    id="roundId"
                    placeholder="Enter Round ID"
                    value={roundId}
                    onChange={(e) => setRoundId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    placeholder="Enter User ID"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2 justify-between items-center w-full">
                <Button variant="outline" onClick={fetchJobDetails} disabled={loadingJobDetails}>
                  {loadingJobDetails ? <Spinner size="sm" className="mr-2" /> : null}
                  Fetch Job Details
                </Button>
                  <Button variant="outline" onClick={extractSkills} disabled={loading1}>
                    {loading1 ? <Spinner size="sm" className="mr-2" /> : null}
                    Extract Skills
                  </Button>
                  <Button onClick={generateQuestions} disabled={loading2}>
                    {loading2 ? <Spinner size="sm" className="mr-2" /> : null}
                    Generate Questions
                  </Button>
              </div>
              <Button variant="outline" onClick={() => {
                extractSkills();
                generateQuestions();
                fetchJobDetails();
              }} disabled={loading1 && loading2 && loadingJobDetails} className="w-full">
                {(loading1 && loading2 && loadingJobDetails) ? <Spinner size="sm" className="mr-2" /> : null}
                Extract All Data
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Job Details Tab */}
        <TabsContent value="job-details">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Job Details</CardTitle>
                <CardDescription>
                  Job information for Round ID: {roundId}, User ID: {userId}
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={fetchJobDetails} 
                disabled={loadingJobDetails}
              >
                {loadingJobDetails ? <Spinner size="sm" className="mr-2" /> : null}
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {jobDetails ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Job Title</h3>
                      <p className="text-lg">{jobDetails.job_title}</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Company</h3>
                      <p className="text-lg">{jobDetails.company_name}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Experience Required</h3>
                    <p className="text-lg">{jobDetails.min_experience} - {jobDetails.max_experience} years</p>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Job Description</h3>
                    <div 
                      className="prose max-w-none border rounded-md p-4 bg-muted/30"
                      dangerouslySetInnerHTML={{ __html: jobDetails.job_description }}
                    />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Interview Rounds</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Round ID</TableHead>
                          <TableHead>Interview Type</TableHead>
                          <TableHead>Skills Count</TableHead>
                          <TableHead>Question Pools Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobDetails.rounds.map((round) => (
                          <TableRow key={round.roundId}>
                            <TableCell>{round.roundId}</TableCell>
                            <TableCell>{round.interview_type}</TableCell>
                            <TableCell>{round.skill_matrix.length}</TableCell>
                            <TableCell>{round.question_pools.length}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground mb-4">No job details available</p>
                  <Button onClick={fetchJobDetails} disabled={loadingJobDetails}>
                    {loadingJobDetails ? <Spinner size="sm" className="mr-2" /> : null}
                    Fetch Job Details
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={() => setActiveTab("form")}>
                Back to Form
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="skills">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Extracted Skills</CardTitle>
                <CardDescription>
                  Skills extracted for Round ID: {roundId}, User ID: {userId}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setAddSkillDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Skill
                </Button>
                {modifiedSkills.length > 0 && (
                  <Button 
                    onClick={postModifiedSkills} 
                    disabled={creatingBatchSkills}
                    className="flex items-center gap-2"
                  >
                    {creatingBatchSkills ? (
                      <Spinner size="sm" className="mr-2" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                )}
                {skillsData && skillsData.skill_matrix.length > 0 && (
                  <Button 
                    onClick={createAllSkills} 
                    disabled={creatingBatchSkills}
                    className="flex items-center gap-2"
                  >
                    {creatingBatchSkills ? (
                      <Spinner size="sm" className="mr-2" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create All Skills
                  </Button>
                )}
              </div>
            </CardHeader>
            {creatingBatchSkills && (
              <div className="px-6 py-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Creating skills... ({Math.min(skillsCreationProgress, 100)}%)
                  </span>
                </div>
                <Progress value={skillsCreationProgress} className="h-2" />
              </div>
            )}
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[5%]">Priority</TableHead>
                      <TableHead className="w-[35%]">Skill Name</TableHead>
                      <TableHead className="w-[15%]">Level</TableHead>
                      <TableHead className="w-[15%]">Requirement</TableHead>
                      <TableHead className="w-[15%]">Action</TableHead>
                      <TableHead className="w-[15%]">Delete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skillsData && skillsData.skill_matrix.map((skill) => (
                      <TableRow key={`api-skill-${skill.skill_id}-${skill.name}`}>
                        <TableCell>{skill.priority}</TableCell>
                        <TableCell className="font-medium">{skill.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getLevelClass(skill.level)}>
                            {skill.level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getRequirementClass(skill.requirement)}>
                            {skill.requirement}
                          </Badge>
                        </TableCell>
                        <TableCell>{skill.action}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteSkill(skill)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* {createdSkills.map((skill, index) => (
                      <TableRow key={`created-skill-${index}`} className="bg-green-50">
                        <TableCell>{skill.priority}</TableCell>
                        <TableCell className="font-medium">{skill.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getLevelClass(skill.level)}>
                            {skill.level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getRequirementClass(skill.requirement)}>
                            {skill.requirement}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                            <Check className="h-3 w-3 mr-1" />
                            Created
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteSkill(skill)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))} */}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("form")}>
                Back to Form
              </Button>
              {skillCreationResults.success > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    {skillCreationResults.success} Created
                  </Badge>
                  {skillCreationResults.failed > 0 && (
                    <Badge variant="outline" className="bg-red-100 text-red-800">
                      {skillCreationResults.failed} Failed
                    </Badge>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => setSkillResponsesDialogOpen(true)}
                  >
                    View Responses
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="questions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Generated Questions</CardTitle>
                <CardDescription>
                  Questions for Round ID: {roundId}, User ID: {userId}
                </CardDescription>
              </div>
              {questionsData && questionsData.questions.length > 0 && (
                <Button 
                  onClick={createAllQuestions} 
                  disabled={creatingBatchQuestions}
                  className="flex items-center gap-2"
                >
                  {creatingBatchQuestions ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create All Questions
                </Button>
              )}
            </CardHeader>
            {creatingBatchQuestions && (
              <div className="px-6 py-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Creating questions... ({Math.min(questionCreationProgress, 100)}%)
                  </span>
                </div>
                <Progress value={questionCreationProgress} className="h-2" />
              </div>
            )}
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[5%]">No.</TableHead>
                      <TableHead className="w-[20%]">Title</TableHead>
                      <TableHead className="w-[25%]">Description</TableHead>
                      <TableHead className="w-[15%]">Skill</TableHead>
                      <TableHead className="w-[10%]">Tags</TableHead>
                      <TableHead className="w-[10%]">Coding</TableHead>
                      <TableHead className="w-[15%]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questionsData && questionsData.questions.map((question, index) => (
                      <TableRow 
                        key={`${question.sl_no}-${question.skill}-${index}`} 
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell>{question.sl_no}</TableCell>
                        <TableCell className="font-medium">{question.question_title}</TableCell>
                        <TableCell>
                          <div className="max-h-24 overflow-y-auto text-sm">
                            {question.candidate_description.length > 150 
                              ? `${question.candidate_description.substring(0, 150)}...` 
                              : question.candidate_description}
                          </div>
                        </TableCell>
                        <TableCell>{question.skill}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {question.tags.split(', ').slice(0, 2).map((tag, tagIndex) => (
                              <Badge key={`${tag}-${tagIndex}`} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {question.tags.split(', ').length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{question.tags.split(', ').length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getCodingClass(question.coding)}>
                            {question.coding}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => viewQuestionDetails(question)}
                            className="w-full flex justify-between items-center"
                          >
                            View Details
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Batch created questions display */}
                    {createdQuestionIds.length > 0 && (
                      <TableRow className="bg-green-50">
                        <TableCell colSpan={7} className="text-center py-4">
                          <div className="flex flex-col items-center gap-2">
                            <Check className="h-5 w-5 text-green-600" />
                            <p className="font-medium">Successfully created {createdQuestionIds.length} question(s)</p>
                            <p className="text-sm text-muted-foreground">
                              Question IDs: {createdQuestionIds.join(", ")}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("form")}>
                Back to Form
              </Button>
              {questionCreationResults.success > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    {questionCreationResults.success} Created
                  </Badge>
                  {questionCreationResults.failed > 0 && (
                    <Badge variant="outline" className="bg-red-100 text-red-800">
                      {questionCreationResults.failed} Failed
                    </Badge>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => setQuestionResponsesDialogOpen(true)}
                  >
                    View Responses
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Skill Dialog */}
      <Dialog open={addSkillDialogOpen} onOpenChange={setAddSkillDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Skill</DialogTitle>
            <DialogDescription>
              Enter the details for the new skill.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="skillName" className="text-right">
                Skill Name
              </Label>
              <Input
                id="skillName"
                value={newSkill.name}
                onChange={(e) => setNewSkill({...newSkill, name: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="skillLevel" className="text-right">
                Level
              </Label>
              <Select
                value={newSkill.level}
                onValueChange={(value) => setNewSkill({...newSkill, level: value})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="skillRequirement" className="text-right">
                Requirement
              </Label>
              <Select
                value={newSkill.requirement}
                onValueChange={(value) => setNewSkill({...newSkill, requirement: value})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select Requirement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Must-have">Must-have</SelectItem>
                  <SelectItem value="Nice-to-have">Nice-to-have</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="skillPriority" className="text-right">
                Priority
              </Label>
              <Input
                id="skillPriority"
                type="number"
                min="1"
                value={newSkill.priority}
                onChange={(e) => setNewSkill({...newSkill, priority: parseInt(e.target.value) || 1})}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSkillDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSkill}>Add Skill</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skills Responses Dialog */}
      <Dialog open={skillResponsesDialogOpen} onOpenChange={setSkillResponsesDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Skills Creation Responses</DialogTitle>
            <DialogDescription>
              API response details for batch skill creation
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline" className="bg-green-100 text-green-800">
                {skillCreationResults.success} Created
              </Badge>
              {skillCreationResults.failed > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-800">
                  {skillCreationResults.failed} Failed
                </Badge>
              )}
            </div>
            <pre className="p-4 bg-muted rounded-md overflow-auto text-sm max-h-[400px]">
              {JSON.stringify(skillResponses, null, 2)}
            </pre>
          </div>
          <DialogFooter>
            <Button onClick={() => setSkillResponsesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Questions Responses Dialog */}
      <Dialog open={questionResponsesDialogOpen} onOpenChange={setQuestionResponsesDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto overflow-x-auto">
          <DialogHeader>
            <DialogTitle>Questions Creation Responses</DialogTitle>
            <DialogDescription>
              API response details for batch question creation
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline" className="bg-green-100 text-green-800">
                {questionCreationResults.success} Created
              </Badge>
              {questionCreationResults.failed > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-800">
                  {questionCreationResults.failed} Failed
                </Badge>
              )}
            </div>
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Created Question IDs:</h4>
              <div className="p-2 bg-muted/50 rounded-md overflow-x-auto  whitespace-pre-wrap flex flex-wrap gap-2">
                {createdQuestionIds.join(", ")}
              </div>
            </div>
            <pre className="p-4 bg-muted rounded-md overflow-auto text-sm max-h-[300px]">
              {JSON.stringify(questionResponses, null, 2)}
            </pre>
          </div>
          <DialogFooter>
            <Button onClick={() => setQuestionResponsesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
