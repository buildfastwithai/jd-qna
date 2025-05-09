import React from "react";
import { Badge } from "./badge";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Question {
  question: string;
  answer: string;
  category: "Technical" | "Experience" | "Problem Solving" | "Soft Skills";
  difficulty: "Easy" | "Medium" | "Hard";
}

interface QuestionsDisplayProps {
  questions: Question[];
  onGeneratePDF?: () => void;
}

export function QuestionsDisplay({ questions }: QuestionsDisplayProps) {
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  const toggleQuestion = (index: number) => {
    setExpandedId(expandedId === index ? null : index);
  };

  const getDifficultyColor = (difficulty: Question["difficulty"]) => {
    switch (difficulty) {
      case "Easy":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      case "Medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      case "Hard":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      default:
        return "";
    }
  };

  const getCategoryColor = (category: Question["category"]) => {
    switch (category) {
      case "Technical":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
      case "Experience":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100";
      case "Problem Solving":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100";
      case "Soft Skills":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100";
      default:
        return "";
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
                      </div>
                      <h3 className="font-medium">{question.question}</h3>

                      {expandedId === index && question.answer && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-muted-foreground mb-1">
                            Suggested Answer:
                          </p>
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
