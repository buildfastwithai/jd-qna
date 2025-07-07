"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface QuestionDetail {
  question_title: string;
  question_description: string;
  candidate_description: string;
  ideal_answer: string;
  tags: string;
  skill: string;
  pool_name: string;
  coding: string;
  mandatory: string;
  hide_in_floreport: string;
}

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  
  useEffect(() => {
    // In a real scenario, we'd fetch this data from an API or use state management
    // For demo purposes, we're parsing it from URL params
    try {
      const questionData = searchParams.get("data");
      
      if (questionData) {
        setQuestion(JSON.parse(decodeURIComponent(questionData)));
      }
    } catch (error) {
      console.error("Error parsing question data:", error);
    }
  }, [searchParams]);

  if (!question) {
    return (
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-6">Question Details</h1>
        <Card>
          <CardContent className="py-10">
            <p className="text-center text-muted-foreground">
              No question data available.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              onClick={() => router.push("/skill-question")}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Questions
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/skill-question")}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Questions
      </Button>

      <h1 className="text-2xl font-bold mb-6">{question.question_title}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Question Details</CardTitle>
              <CardDescription>Detailed information about the question</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Description</h3>
                <p className="mt-2 text-muted-foreground">{question.question_description}</p>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold">Candidate Facing Description</h3>
                <p className="mt-2 text-muted-foreground">{question.candidate_description}</p>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold">Ideal Answer</h3>
                <p className="mt-2 text-muted-foreground whitespace-pre-line">{question.ideal_answer}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Skills & Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Skill</h3>
                <p className="mt-1 font-semibold">{question.skill}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium">Pool Name</h3>
                <p className="mt-1 font-semibold">{question.pool_name}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium">Tags</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {question.tags.split(", ").map((tag, index) => (
                    <Badge key={`${tag}-${index}`} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Coding Question</span>
                <Badge variant={question.coding === "Yes" ? "default" : "outline"}>
                  {question.coding}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Mandatory</span>
                <Badge variant={question.mandatory === "Yes" ? "default" : "outline"}>
                  {question.mandatory}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Hidden in Report</span>
                <Badge variant={question.hide_in_floreport === "Yes" ? "default" : "outline"}>
                  {question.hide_in_floreport}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-6 flex justify-center">Loading question details...</div>}>
      <ResultContent />
    </Suspense>
  );
}
