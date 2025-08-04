"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";
import { Textarea } from "./textarea";
import { Label } from "./label";
import { Spinner } from "./spinner";

interface DeleteQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionContent: string;
  onDelete: (feedback: string) => Promise<void>;
  isLoading?: boolean;
}

export function DeleteQuestionDialog({
  open,
  onOpenChange,
  questionContent,
  onDelete,
  isLoading = false,
}: DeleteQuestionDialogProps) {
  const [feedback, setFeedback] = useState("");

  const handleDelete = async () => {
    await onDelete(feedback);
    setFeedback("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setFeedback("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Question</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this question? This action cannot be undone.
            Please provide a reason for deletion to help us improve our question generation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="question-content">Question to delete:</Label>
            <div className="p-3 bg-muted rounded-md text-sm">
              {questionContent}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback">
              Reason for deletion <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="feedback"
              placeholder="e.g., Question is too basic, not relevant to the role, unclear wording..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Deleting...
              </>
            ) : (
              "Delete Question"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 