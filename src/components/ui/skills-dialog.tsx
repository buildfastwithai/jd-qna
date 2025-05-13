"use client";

import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Spinner } from "./spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { SkillLevel, Requirement } from "@prisma/client";
import { SkillWithMetadata } from "../JDQnaForm";

interface SkillsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  skills: SkillWithMetadata[];
  onSkillsChange: (skills: SkillWithMetadata[]) => void;
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
  const [newSkillLevel, setNewSkillLevel] = useState<SkillLevel>(
    SkillLevel.INTERMEDIATE
  );
  const [newSkillRequirement, setNewSkillRequirement] = useState<Requirement>(
    Requirement.OPTIONAL
  );

  const handleAddSkill = () => {
    if (
      newSkill.trim() &&
      !skills.some((skill) => skill.name === newSkill.trim())
    ) {
      onSkillsChange([
        ...skills,
        {
          name: newSkill.trim(),
          level: newSkillLevel,
          requirement: newSkillRequirement,
        },
      ]);
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    onSkillsChange(skills.filter((skill) => skill.name !== skillToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const updateSkillLevel = (skillName: string, level: SkillLevel) => {
    onSkillsChange(
      skills.map((skill) =>
        skill.name === skillName ? { ...skill, level } : skill
      )
    );
  };

  const updateSkillRequirement = (
    skillName: string,
    requirement: Requirement
  ) => {
    onSkillsChange(
      skills.map((skill) =>
        skill.name === skillName ? { ...skill, requirement } : skill
      )
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skills Extracted from Job Description</DialogTitle>
          <DialogDescription>
            Review, add, or remove skills. Set the level
            (Professional/Intermediate/Beginner) and requirement
            (Mandatory/Optional) for each skill.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-4">
          <div className="max-h-60 overflow-y-auto p-2 border rounded-md">
            {skills.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">
                No skills extracted. Add skills manually or try uploading a
                different job description.
              </p>
            ) : (
              <div className="space-y-3">
                {skills.map((skill) => (
                  <div
                    key={skill.name}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 border rounded-md"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium">{skill.name}</span>
                      <button
                        onClick={() => handleRemoveSkill(skill.name)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Select
                        value={skill.level}
                        onValueChange={(value) =>
                          updateSkillLevel(skill.name, value as SkillLevel)
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SkillLevel.BEGINNER}>
                            Beginner
                          </SelectItem>
                          <SelectItem value={SkillLevel.INTERMEDIATE}>
                            Intermediate
                          </SelectItem>
                          <SelectItem value={SkillLevel.PROFESSIONAL}>
                            Professional
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={skill.requirement}
                        onValueChange={(value) =>
                          updateSkillRequirement(
                            skill.name,
                            value as Requirement
                          )
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Requirement" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={Requirement.MANDATORY}>
                            Mandatory
                          </SelectItem>
                          <SelectItem value={Requirement.OPTIONAL}>
                            Optional
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Add a skill..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />

            <Select
              value={newSkillLevel}
              onValueChange={(value) => setNewSkillLevel(value as SkillLevel)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SkillLevel.BEGINNER}>Beginner</SelectItem>
                <SelectItem value={SkillLevel.INTERMEDIATE}>
                  Intermediate
                </SelectItem>
                <SelectItem value={SkillLevel.PROFESSIONAL}>
                  Professional
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={newSkillRequirement}
              onValueChange={(value) =>
                setNewSkillRequirement(value as Requirement)
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Requirement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={Requirement.MANDATORY}>Mandatory</SelectItem>
                <SelectItem value={Requirement.OPTIONAL}>Optional</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleAddSkill} disabled={!newSkill.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4">
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
              "Generate Questions and Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
