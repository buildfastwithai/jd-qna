"use client";

import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Spinner } from "./spinner";

interface SkillsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  onGenerateQuestions: () => void;
  isGenerating: boolean;
}

export function SkillsDialog({
  isOpen,
  onOpenChange,
  skills,
  onSkillsChange,
  onGenerateQuestions,
  isGenerating,
}: SkillsDialogProps) {
  const [newSkill, setNewSkill] = useState("");

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      onSkillsChange([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    onSkillsChange(skills.filter((skill) => skill !== skillToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSkill();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skills Extracted from Job Description</DialogTitle>
          <DialogDescription>
            Review, add, or remove skills to generate targeted interview questions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-2 border rounded-md">
            {skills.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">No skills extracted. Add skills manually or try uploading a different job description.</p>
            ) : (
              skills.map((skill) => (
                <div
                  key={skill}
                  className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm"
                >
                  <span>{skill}</span>
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="text-secondary-foreground/70 hover:text-secondary-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add a skill..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button size="sm" onClick={handleAddSkill} disabled={!newSkill.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onGenerateQuestions}
            disabled={isGenerating || skills.length === 0}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Generating Questions...
              </>
            ) : (
              "Generate Questions"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 