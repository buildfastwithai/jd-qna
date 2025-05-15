"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface QuestionLikeButtonsProps {
  questionId: string;
  initialStatus?: "LIKED" | "DISLIKED" | "NONE";
  onStatusChange?: (status: "LIKED" | "DISLIKED" | "NONE") => void;
}

export function QuestionLikeButtons({
  questionId,
  initialStatus = "NONE",
  onStatusChange,
}: QuestionLikeButtonsProps) {
  const [status, setStatus] = useState<"LIKED" | "DISLIKED" | "NONE">(initialStatus);
  const [isLoading, setIsLoading] = useState(false);

  const handleLike = async (newStatus: "LIKED" | "DISLIKED" | "NONE") => {
    // If clicking the same button, toggle back to NONE
    const nextStatus = status === newStatus ? "NONE" : newStatus;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/questions/${questionId}/like`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update like status");
      }

      setStatus(nextStatus);
      if (onStatusChange) {
        onStatusChange(nextStatus);
      }
      
      if (nextStatus === "LIKED") {
        toast.success("Question marked as helpful");
      } else if (nextStatus === "DISLIKED") {
        toast.info("Question marked as not helpful");
      }
    } catch (error) {
      toast.error("Failed to update question status");
      console.error("Error updating question like status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleLike("LIKED")}
        disabled={isLoading}
        className={cn(
          "rounded-full",
          status === "LIKED" && "bg-green-100 text-green-700 border-green-200"
        )}
      >
        <ThumbsUp className={cn("h-4 w-4", status === "LIKED" ? "fill-green-500" : "")} />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleLike("DISLIKED")}
        disabled={isLoading}
        className={cn(
          "rounded-full",
          status === "DISLIKED" && "bg-red-100 text-red-700 border-red-200"
        )}
      >
        <ThumbsDown className={cn("h-4 w-4", status === "DISLIKED" ? "fill-red-500" : "")} />
      </Button>
    </div>
  );
} 