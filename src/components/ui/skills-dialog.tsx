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
  const [newSkillNumQuestions, setNewSkillNumQuestions] = useState(1);
  const [newSkillDifficulty, setNewSkillDifficulty] = useState("Medium");

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
          numQuestions: newSkillNumQuestions,
          difficulty: newSkillDifficulty,
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

  const updateSkillNumQuestions = (skillName: string, numQuestions: number) => {
    onSkillsChange(
      skills.map((skill) =>
        skill.name === skillName ? { ...skill, numQuestions } : skill
      )
    );
  };

  const updateSkillDifficulty = (skillName: string, difficulty: string) => {
    onSkillsChange(
      skills.map((skill) =>
        skill.name === skillName ? { ...skill, difficulty } : skill
      )
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skills Extracted from Job Description</DialogTitle>
          <DialogDescription>
            Review, add, or remove skills. Set the level, requirement, number of
            questions, and difficulty for each skill.
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
                    className="flex flex-col gap-2 p-2 border rounded-md"
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        value={skill.level}
                        onValueChange={(value) =>
                          updateSkillLevel(skill.name, value as SkillLevel)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent className="min-w-[160px] z-[100]">
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
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Requirement" />
                        </SelectTrigger>
                        <SelectContent className="min-w-[160px] z-[100]">
                          <SelectItem value={Requirement.MANDATORY}>
                            Mandatory
                          </SelectItem>
                          <SelectItem value={Requirement.OPTIONAL}>
                            Optional
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="flex flex-col">
                        <label className="text-xs mb-1">
                          Number of Questions
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={skill.numQuestions || 1}
                          onChange={(e) =>
                            updateSkillNumQuestions(
                              skill.name,
                              Math.min(
                                10,
                                Math.max(1, parseInt(e.target.value) || 1)
                              )
                            )
                          }
                          className="w-full"
                        />
                      </div>

                      <Select
                        value={skill.difficulty || "Medium"}
                        onValueChange={(value) =>
                          updateSkillDifficulty(skill.name, value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Difficulty" />
                        </SelectTrigger>
                        <SelectContent className="min-w-[160px] z-[100]">
                          <SelectItem value="Easy">Easy</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Add a skill..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={handleKeyDown}
              className="col-span-1 sm:col-span-2"
            />

            <Select
              value={newSkillLevel}
              onValueChange={(value) => setNewSkillLevel(value as SkillLevel)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent className="min-w-[160px] z-[100]">
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
              <SelectTrigger>
                <SelectValue placeholder="Requirement" />
              </SelectTrigger>
              <SelectContent className="min-w-[160px] z-[100]">
                <SelectItem value={Requirement.MANDATORY}>Mandatory</SelectItem>
                <SelectItem value={Requirement.OPTIONAL}>Optional</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex flex-col">
              <label className="text-xs mb-1">Number of Questions</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={newSkillNumQuestions}
                onChange={(e) =>
                  setNewSkillNumQuestions(
                    Math.min(10, Math.max(1, parseInt(e.target.value) || 1))
                  )
                }
              />
            </div>

            <Select
              value={newSkillDifficulty}
              onValueChange={(value) => setNewSkillDifficulty(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent className="min-w-[160px] z-[100]">
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleAddSkill}
              disabled={!newSkill.trim()}
              className="col-span-1 sm:col-span-2"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Skill
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
