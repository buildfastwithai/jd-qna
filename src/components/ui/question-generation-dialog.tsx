"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Spinner } from "./spinner";
import { Progress } from "./progress";

interface QuestionGenerationDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  showProgress?: boolean;
  progressValue?: number;
  progressText?: string;
}

export function QuestionGenerationDialog({
  open,
  title = "Generating Questions",
  description = "Please wait while we generate interview questions for your skills...",
  showProgress = false,
  progressValue = 0,
  progressText,
}: QuestionGenerationDialogProps) {
  const [dots, setDots] = useState("");

  // Animate dots for loading effect
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return "";
        return prev + ".";
      });
    }, 500);

    return () => clearInterval(interval);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg border-0 shadow-2xl"
        hideCloseButton
      >
        <div className="flex flex-col items-center justify-center text-center space-y-6 py-8 px-6 bg-gradient-to-b from-background to-muted/20 rounded-lg">
          {/* Spinner and Title */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative p-4 rounded-full bg-primary/10 border border-primary/20 animate-pulse">
              <Spinner size="lg" className="text-primary" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold text-center">
                {title}
              </DialogTitle>
              <DialogDescription className="text-center text-muted-foreground max-w-sm">
                {description}
              </DialogDescription>
            </div>
          </div>

          {/* Progress Section */}
          {showProgress && (
            <div className="w-full max-w-sm space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                <Progress
                  value={progressValue}
                  className="w-full h-3 bg-muted"
                />
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span className="font-medium">{progressValue}%</span>
                  <span>Complete</span>
                </div>
              </div>
              {progressText && (
                <p className="text-sm text-foreground font-medium bg-background/50 px-3 py-2 rounded-md border">
                  {progressText}
                </p>
              )}
            </div>
          )}

          {/* Loading Message */}
          <div className="space-y-3 max-w-md">
            <p className="text-sm text-muted-foreground font-medium">
              This may take a few moments{dots}
            </p>
            <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground/75">
              <span>🤖</span>
              <span>
                We're analyzing your skills and creating relevant interview
                questions
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
