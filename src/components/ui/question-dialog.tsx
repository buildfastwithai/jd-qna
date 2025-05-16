"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "./dialog";
import { Button } from "./button";
import { QuestionLikeButtons } from "./question-like-buttons";
import { cn } from "@/lib/utils";

interface QuestionDialogProps {
  questionId: string;
  question: string;
  answer: string;
  category: string;
  difficulty: string;
  liked?: "LIKED" | "DISLIKED" | "NONE";
  onStatusChange?: (status: "LIKED" | "DISLIKED" | "NONE") => void;
}

export function QuestionDialog({
  questionId,
  question,
  answer,
  category,
  difficulty,
  liked = "NONE",
  onStatusChange,
}: QuestionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Helper function to get CSS class based on difficulty
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

  // Helper function to get CSS class based on category
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="cursor-pointer hover:underline">{question}</div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{question}</DialogTitle>
          <div className="flex gap-2 mt-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getCategoryClass(
                category
              )}`}
            >
              {category}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getDifficultyClass(
                difficulty
              )}`}
            >
              {difficulty}
            </span>
          </div>
        </DialogHeader>
        <div className="py-4">
          <h3 className="text-sm font-semibold mb-2">Suggested Answer:</h3>
          <div className="bg-muted/30 p-4 rounded-md text-sm whitespace-pre-wrap">
            {answer}
          </div>
        </div>
        <DialogFooter className="flex justify-between items-center">
          <div className="flex-grow">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </div>
          <div>
            <QuestionLikeButtons
              questionId={questionId}
              initialStatus={liked}
              onStatusChange={onStatusChange}
            />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
