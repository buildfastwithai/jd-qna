import React, { useState } from "react";
import { Badge } from "./badge";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion";
import { QuestionLikeButtons } from "./question-like-buttons";

export interface Question {
  question: string;
  answer: string;
  category: "Technical" | "Experience" | "Problem Solving" | "Soft Skills";
  difficulty: "Easy" | "Medium" | "Hard";
  skillName?: string;
  id?: string;
  liked?: "LIKED" | "DISLIKED" | "NONE";
}

interface QuestionsDisplayProps {
  questions: Question[];
  onGeneratePDF?: () => void;
  enableLikeButtons?: boolean;
}

export function QuestionsDisplay({ 
  questions, 
  onGeneratePDF,
  enableLikeButtons = false 
}: QuestionsDisplayProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleQuestion = (index: number) => {
    setExpandedId(expandedId === index ? null : index);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Technical":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "Experience":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "Problem Solving":
        return "bg-purple-100 text-purple-800 hover:bg-purple-100";
      case "Soft Skills":
        return "bg-orange-100 text-orange-800 hover:bg-orange-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "Medium":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "Hard":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Generated Interview Questions</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ul className="space-y-4">
            {questions.map((question, index) => (
              <li key={index}>
                <div
                  className={cn(
                    "border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                    expandedId === index ? "bg-muted/50" : ""
                  )}
                  onClick={() => toggleQuestion(index)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getCategoryColor(question.category)}>
                          {question.category}
                        </Badge>
                        <Badge
                          className={getDifficultyColor(question.difficulty)}
                        >
                          {question.difficulty}
                        </Badge>
                        {question.skillName && (
                          <Badge className="bg-slate-100 text-slate-800">
                            {question.skillName}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium">{question.question}</h3>

                      {expandedId === index && question.answer && (
                        <div className="mt-4">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-sm font-semibold text-muted-foreground">
                              Suggested Answer:
                            </p>
                            {enableLikeButtons && question.id && (
                              <QuestionLikeButtons
                                questionId={question.id}
                                initialStatus={question.liked || "NONE"}
                              />
                            )}
                          </div>
                          <div className="bg-muted/30 p-3 rounded-md text-sm">
                            {question.answer}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="pl-2">
                      {expandedId === index ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
