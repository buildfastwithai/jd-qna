"use client";

import { useState, useMemo, useEffect } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { Trash2, MessageSquarePlus, FileSpreadsheet} from "lucide-react";
import { toast } from "sonner";
import { SkillFeedbackDialog } from "./ui/skill-feedback-dialog";
import { SkillFeedbackViewDialog } from "./ui/skill-feedback-view-dialog";
import { AddSkillDialog } from "./ui/add-skill-dialog";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Spinner } from "./ui/spinner";
import { useRouter } from "next/navigation";

// Define interfaces for the types from Prisma
interface Skill {
  id: string;
  name: string;
  level: "BEGINNER" | "INTERMEDIATE" | "PROFESSIONAL" | "EXPERT";
  requirement: "MANDATORY" | "OPTIONAL";
  numQuestions: number;
  difficulty?: string;
  recordId: string;
  priority?: number;
  category?: "TECHNICAL" | "FUNCTIONAL" | "BEHAVIORAL" | "COGNITIVE";
  questionFormat?: string;
  feedbacks?: { id: string; content: string; createdAt: string }[];
  deleted?: boolean;
}

interface SkillsTableProps {
  skills: Skill[];
  recordId: string;
  onUpdateSkill: (
    skillId: string,
    field:
      | "level"
      | "requirement"
      | "numQuestions"
      | "difficulty"
      | "priority"
      | "category"
      | "questionFormat",
    value: string | number
  ) => Promise<void>;
  getSkillQuestionCount: (skillId: string) => number;
  onDeleteSkill: (skillId: string) => void;
  onBulkDeleteSkills?: (skillIds: string[]) => void;
  onSkillAdded: () => void;
  loading: boolean;
  onGenerateQuestionsForSkills?: (skillIds: string[]) => void;
  onSkillsChanged?: (changed: boolean) => void;
}

export default function SkillsTable({
  skills,
  recordId,
  onUpdateSkill,
  getSkillQuestionCount,
  onDeleteSkill,
  onBulkDeleteSkills,
  onSkillAdded,
  loading,
  onGenerateQuestionsForSkills,
  onSkillsChanged,
}: SkillsTableProps) {
  // State to track feedback counts and refresh trigger
  const [feedbackCounts, setFeedbackCounts] = useState<Record<string, number>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Track if any skill's numQuestions or feedback has changed
  const [initialSkills, setInitialSkills] = useState<Skill[]>([]);
  const [skillsChanged, setSkillsChanged] = useState(false);
  useEffect(() => {
    setInitialSkills(skills.map(s => ({ ...s })));
    setSkillsChanged(false);
    if (onSkillsChanged) onSkillsChanged(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let changed = false;
    if (initialSkills.length !== skills.length) changed = true;
    else {
      for (let i = 0; i < skills.length; i++) {
        if (skills[i].numQuestions !== initialSkills[i]?.numQuestions) {
          changed = true;
          break;
        }
        // Feedback count change
        if ((feedbackCounts[skills[i].id] || 0) !== (initialSkills[i]?.feedbacks?.length || 0)) {
          changed = true;
          break;
        }
      }
    }
    setSkillsChanged(changed);
    if (onSkillsChanged) onSkillsChanged(changed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skills, feedbackCounts]);

  // Multi-select state
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Excel export state
  const [excelExporting, setExcelExporting] = useState(false);
  const router = useRouter();

  // Fetch feedback counts for each skill - optimized to avoid unnecessary fetches
  useEffect(() => {
    const fetchFeedbackCounts = async () => {
      const counts: Record<string, number> = {};
      const newSkillIds = skills.map((skill) => skill.id);

      // Keep existing counts for skills that haven't changed
      const existingCounts = { ...feedbackCounts };

      // Only fetch for skills that don't already have counts
      const skillsToFetch = skills.filter(
        (skill) => existingCounts[skill.id] === undefined
      );

      // Fetch counts only for new skills
      for (const skill of skillsToFetch) {
        try {
          const response = await fetch(`/api/skills/${skill.id}/feedback`, {
            headers: {
              Authorization: `Bearer ${
                process.env.NEXT_PUBLIC_AUTH_TOKEN || ""
              }`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            counts[skill.id] = data.feedbacks?.length || 0;
          }
        } catch (error) {
          console.error(
            `Error fetching feedback count for skill ${skill.id}:`,
            error
          );
        }
      }

      // Combine existing counts with new counts, but only for skills that still exist
      const updatedCounts = { ...existingCounts, ...counts };
      const finalCounts: Record<string, number> = {};

      // Filter out counts for skills that no longer exist
      newSkillIds.forEach((id) => {
        if (updatedCounts[id] !== undefined) {
          finalCounts[id] = updatedCounts[id];
        }
      });

      setFeedbackCounts(finalCounts);
    };

    fetchFeedbackCounts();
  }, [skills, refreshTrigger]);

  // Create a wrapper for the onDeleteSkill function to clean up feedback counts
  const handleDeleteSkill = (skillId: string) => {
    // Remove the feedback count for the deleted skill
    setFeedbackCounts((prevCounts) => {
      const newCounts = { ...prevCounts };
      delete newCounts[skillId];
      return newCounts;
    });

    // Call the original onDeleteSkill function
    onDeleteSkill(skillId);
  };

  // Handle feedback submission
  const handleFeedbackSubmitted = () => {
    window.location.reload(); // Reload to reflect feedback changes
    setRefreshTrigger((prev) => prev + 1);
    setSkillsChanged(true);
    if (onSkillsChanged) onSkillsChanged(true);
  };
  // Column helper
  const columnHelper = createColumnHelper<Skill>();

  // Get level label
  const getLevelLabel = (level: string) => {
    switch (level) {
      case "BEGINNER":
        return "Beginner";
      case "INTERMEDIATE":
        return "Intermediate";
      case "PROFESSIONAL":
        return "Professional";
      case "EXPERT":
        return "Expert";
      default:
        return level;
    }
  };

  // Get category label
  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case "TECHNICAL":
        return "Technical";
      case "FUNCTIONAL":
        return "Functional";
      case "BEHAVIORAL":
        return "Behavioral";
      case "COGNITIVE":
        return "Cognitive";
      default:
        return "Not Specified";
    }
  };

  console.log(skills);

  // Handle select all checkbox
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select non-deleted skills
      setSelectedSkills(
        new Set(
          skills.filter((skill) => !skill.deleted).map((skill) => skill.id)
        )
      );
    } else {
      setSelectedSkills(new Set());
    }
  };

  // Handle individual skill selection
  const handleSkillSelect = (skillId: string, checked: boolean) => {
    // Don't allow selection of deleted skills
    const skill = skills.find((s) => s.id === skillId);
    if (skill && skill.deleted) {
      return;
    }

    const newSelected = new Set(selectedSkills);
    if (checked) {
      newSelected.add(skillId);
    } else {
      newSelected.delete(skillId);
    }
    setSelectedSkills(newSelected);
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (selectedSkills.size === 0) {
      toast.warning("Please select skills to delete");
      return;
    }
    setConfirmDeleteOpen(true);
  };

  // Confirm and execute bulk delete
  const confirmBulkDelete = () => {
    if (onBulkDeleteSkills) {
      // Remove feedback counts for all deleted skills
      const skillsToDelete = Array.from(selectedSkills);
      setFeedbackCounts((prevCounts) => {
        const newCounts = { ...prevCounts };
        skillsToDelete.forEach((skillId) => {
          delete newCounts[skillId];
        });
        return newCounts;
      });

      onBulkDeleteSkills(skillsToDelete);
    } else {
      // Fallback to individual deletions if bulk delete not provided
      selectedSkills.forEach((skillId) => {
        setFeedbackCounts((prevCounts) => {
          const newCounts = { ...prevCounts };
          delete newCounts[skillId];
          return newCounts;
        });
        onDeleteSkill(skillId);
      });
    }
    setSelectedSkills(new Set());
    setConfirmDeleteOpen(false);
  };

  // Get selected skills for confirmation dialog
  const getSelectedSkillNames = () => {
    return skills
      .filter((skill) => !skill.deleted && selectedSkills.has(skill.id))
      .map((skill) => skill.name);
  };

  // Check if all skills are selected (excluding deleted skills)
  const nonDeletedSkills = skills.filter((skill) => !skill.deleted);
  const isAllSelected =
    nonDeletedSkills.length > 0 &&
    selectedSkills.size === nonDeletedSkills.length;
  const isIndeterminate =
    selectedSkills.size > 0 && selectedSkills.size < nonDeletedSkills.length;

  // Handle Excel export
  const handleExportToExcel = async () => {
    if (!skills.length) {
      toast.error("No skills to export");
      return;
    }

    setExcelExporting(true);
    try {
      const jobTitle = skills[0]?.recordId ? "skills" : "skills";
      const filename = `skills-${jobTitle
        .toLowerCase()
        .replace(/\s+/g, "-")}-${Date.now()}.xlsx`;

      // Prepare skills data for export - simplified format based on user requirements
      const exportSkills = skills.map((skill, index) => ({
        slNo: index + 1,
        poolName: skill.name, // Pool Name contains skill name
        mandatory: "No", // Default to 'No'
        noOfQuestions: 1, // Default to '1'
        skillName: skill.name,
      }));

      const response = await fetch("/api/export-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
        },
        body: JSON.stringify({
          questions: exportSkills,
          format: "skills", // Use 'skills' format instead of 'excel'
          filename,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to export skills");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Skills exported to Excel successfully!");
    } catch (error: any) {
      console.error("Error exporting skills to Excel:", error);
      toast.error(error.message || "Failed to export skills to Excel");
    } finally {
      setExcelExporting(false);
    }
  };

  // Define columns
  const columns = useMemo(
    () => [
      // Selection column
      columnHelper.display({
        id: "select",
        header: () => (
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={handleSelectAll}
            aria-label="Select all skills"
            className="translate-y-[2px]"
            {...(isIndeterminate && { "data-state": "indeterminate" })}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedSkills.has(row.original.id)}
            onCheckedChange={(checked) =>
              handleSkillSelect(row.original.id, checked as boolean)
            }
            aria-label={`Select ${row.original.name}`}
            className="translate-y-[2px]"
          />
        ),
        size: 50,
      }),
      columnHelper.accessor("name", {
        header: "Skill Name",
        cell: (info) => (
          <div className="max-w-full overflow-hidden break-words font-medium">
            {info.getValue()}
          </div>
        ),
        size: 150,
      }),
      columnHelper.accessor("category", {
        header: "Category",
        cell: (info) => (
          <Select
            value={info.getValue() || "TECHNICAL"}
            onValueChange={(value) =>
              onUpdateSkill(info.row.original.id, "category", value)
            }
            disabled={loading}
          >
            <SelectTrigger
              className="min-w-[160px]"
              aria-label={`Select category for ${info.row.original.name}`}
            >
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent
              className="min-w-[160px]"
              position="popper"
              sideOffset={5}
              align="start"
            >
              <SelectItem value="TECHNICAL">Technical</SelectItem>
              <SelectItem value="FUNCTIONAL">Functional</SelectItem>
              <SelectItem value="BEHAVIORAL">Behavioral</SelectItem>
              <SelectItem value="COGNITIVE">Cognitive</SelectItem>
            </SelectContent>
          </Select>
        ),
        size: 120,
      }),
      columnHelper.accessor("level", {
        header: "Level",
        cell: (info) => (
          <Select
            value={info.getValue()}
            onValueChange={(value) =>
              onUpdateSkill(info.row.original.id, "level", value)
            }
            disabled={loading}
          >
            <SelectTrigger
              className="min-w-[160px]"
              aria-label={`Select level for ${info.row.original.name}`}
            >
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent
              className="min-w-[160px]"
              position="popper"
              sideOffset={5}
              align="start"
            >
              <SelectItem value="BEGINNER">Beginner</SelectItem>
              <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
              <SelectItem value="PROFESSIONAL">Professional</SelectItem>
              <SelectItem value="EXPERT">Expert</SelectItem>
            </SelectContent>
          </Select>
        ),
        size: 120,
      }),
      columnHelper.accessor("requirement", {
        header: "Requirement",
        cell: (info) => (
          <Select
            value={info.getValue()}
            onValueChange={(value) => {
              const skillId = info.row.original.id;
              const currentQuestionCount = getSkillQuestionCount(skillId);

              // Remove the validation check that prevents changing from MANDATORY to OPTIONAL
              // This is now handled by the confirmation dialog in SkillRecordEditor.tsx

              // Just update requirement without changing numQuestions
              // to allow OPTIONAL skills with numQuestions > 0
              onUpdateSkill(info.row.original.id, "requirement", value);
            }}
            disabled={loading}
          >
            <SelectTrigger
              className="min-w-[160px]"
              aria-label={`Select requirement for ${info.row.original.name}`}
            >
              <SelectValue placeholder="Requirement" />
            </SelectTrigger>
            <SelectContent
              className="min-w-[160px]"
              position="popper"
              sideOffset={5}
              align="start"
            >
              <SelectItem value="MANDATORY">Mandatory</SelectItem>
              <SelectItem value="OPTIONAL">Optional</SelectItem>
            </SelectContent>
          </Select>
        ),
        size: 120,
      }),
      columnHelper.accessor("priority", {
        header: "Priority",
        cell: (info) => (
          <div className="flex items-center">
            <span>{info.getValue() || "—"}</span>
          </div>
        ),
        size: 80,
      }),
      columnHelper.accessor((row) => row.id, {
        id: "questionCount",
        header: "Questions",
        cell: (info) => {
          const count = getSkillQuestionCount(info.getValue());
          return (
            <div className="flex items-center gap-2">
              <span>{count}</span>
              {count > 0 && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  Generated
                </span>
              )}
            </div>
          );
        },
        size: 100,
      }),
      columnHelper.accessor("numQuestions", {
        header: "Num. of Qs",
        cell: (info) => {
          const skill = info.row.original;
          const value = String(skill.numQuestions || 0);
          return (
            <Select
              value={value}
              onValueChange={(value) => {
                onUpdateSkill(
                  info.row.original.id,
                  "numQuestions",
                  parseInt(value)
                );
                setSkillsChanged(true);
                if (onSkillsChanged) onSkillsChanged(true);
              }}
              disabled={loading}
            >
              <SelectTrigger
                className="min-w-[60px]"
                aria-label={`Select number of questions for ${info.row.original.name}`}
              >
                <SelectValue placeholder="Count" />
              </SelectTrigger>
              <SelectContent
                className="min-w-[60px]"
                position="popper"
                sideOffset={5}
                align="start"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <SelectItem key={num} value={String(num)}>
                    {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
        size: 100,
      }),
      // columnHelper.accessor("difficulty", {
      //   header: "Difficulty",
      //   cell: (info) => (
      //     <Select
      //       value={info.getValue() || "Medium"}
      //       onValueChange={(value) =>
      //         onUpdateSkill(info.row.original.id, "difficulty", value)
      //       }
      //       disabled={loading}
      //     >
      //       <SelectTrigger
      //         className="w-full"
      //         aria-label={`Select difficulty for ${info.row.original.name}`}
      //       >
      //         <SelectValue placeholder="Difficulty" />
      //       </SelectTrigger>
      //       <SelectContent
      //         className="min-w-[160px]"
      //         position="popper"
      //         sideOffset={5}
      //         align="start"
      //       >
      //         <SelectItem value="Easy">Easy</SelectItem>
      //         <SelectItem value="Medium">Medium</SelectItem>
      //         <SelectItem value="Hard">Hard</SelectItem>
      //       </SelectContent>
      //     </Select>
      //   ),
      //   size: 100,
      // }),
      // columnHelper.accessor("questionFormat", {
      //   header: "Question Format",
      //   cell: (info) => (
      //     <Select
      //       value={info.getValue() || "Scenario based"}
      //       onValueChange={(value) =>
      //         onUpdateSkill(info.row.original.id, "questionFormat", value)
      //       }
      //       disabled={loading}
      //     >
      //       <SelectTrigger
      //         className="w-full"
      //         aria-label={`Select question format for ${info.row.original.name}`}
      //       >
      //         <SelectValue placeholder="Format" />
      //       </SelectTrigger>
      //       <SelectContent
      //         className="min-w-[160px]"
      //         position="popper"
      //         sideOffset={5}
      //         align="start"
      //       >
      //         <SelectItem value="Scenario based">Scenario based</SelectItem>
      //         <SelectItem value="Theoretical">Theoretical</SelectItem>
      //         <SelectItem value="Coding challenge">Coding challenge</SelectItem>
      //         <SelectItem value="Behavioral">Behavioral</SelectItem>
      //         <SelectItem value="System design">System design</SelectItem>
      //       </SelectContent>
      //     </Select>
      //   ),
      //   size: 130,
      // }),
      columnHelper.accessor((row) => row.id, {
        id: "feedback",
        header: "Feedback",
        cell: (info) => {
          const skillId = info.getValue();
          const skillName = info.row.original.name;
          const feedbackCount = feedbackCounts[skillId] || 0;

          return (
            <div className="flex items-center space-x-2">
              <SkillFeedbackDialog
                skillId={skillId}
                skillName={skillName}
                onFeedbackSubmitted={handleFeedbackSubmitted}
              />
              {feedbackCount > 0 && (
                <SkillFeedbackViewDialog
                  skillId={skillId}
                  skillName={skillName}
                  feedbackCount={feedbackCount}
                  refreshTrigger={refreshTrigger}
                />
              )}
            </div>
          );
        },
        size: 150,
      }),
      columnHelper.accessor((row) => row.id, {
        id: "actions",
        header: "Actions",
        cell: (info) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDeleteSkill(info.getValue())}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ),
        size: 80,
      }),
    ],
    [columnHelper, getSkillQuestionCount, loading, onUpdateSkill]
  );

  // Sort skills by requirement first, then by priority
  const sortedSkills = useMemo(() => {
    return [...skills].sort((a, b) => {
      // First sort by requirement type (MANDATORY first)
      if (a.requirement !== b.requirement) {
        return a.requirement === "MANDATORY" ? -1 : 1;
      }
      // Then sort by priority (nulls/undefined at the end)
      const aPriority = a.priority ?? 999;
      const bPriority = b.priority ?? 999;
      return aPriority - bPriority;
    });
  }, [skills]);

  // Create table instance
  const table = useReactTable({
    data: sortedSkills,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {selectedSkills.size > 0 && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  if (onGenerateQuestionsForSkills) {
                    // Filter out deleted skills before generating questions
                    const nonDeletedSelectedSkills = Array.from(
                      selectedSkills
                    ).filter((skillId) => {
                      const skill = skills.find((s) => s.id === skillId);
                      return skill && !skill.deleted;
                    });
                    
                    onGenerateQuestionsForSkills(nonDeletedSelectedSkills);
                  }
                }}
                disabled={loading}
              >
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                Generate Questions ({selectedSkills.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedSkills.size})
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportToExcel}
            disabled={excelExporting || loading || skills.length === 0}
          >
            {excelExporting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Excel
              </>
            )}
          </Button>
          <AddSkillDialog recordId={recordId} onSkillAdded={onSkillAdded} />
        </div>
      </div>
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{
                        width: `${header.column.getSize()}px`,
                        minWidth: `${header.column.getSize()}px`,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{
                          width: `${cell.column.getSize()}px`,
                          minWidth: `${cell.column.getSize()}px`,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No skills found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the following{" "}
              {selectedSkills.size} skill{selectedSkills.size > 1 ? "s" : ""}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="max-h-32 overflow-y-auto">
              <ul className="list-disc list-inside space-y-1">
                {getSelectedSkillNames().map((name, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
