"use client";

import { useState, useMemo } from "react";
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
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

// Define interfaces for the types from Prisma
interface Skill {
  id: string;
  name: string;
  level: "BEGINNER" | "INTERMEDIATE" | "PROFESSIONAL";
  requirement: "MANDATORY" | "OPTIONAL";
  numQuestions: number;
  difficulty?: string;
  recordId: string;
  priority?: number;
}

interface SkillsTableProps {
  skills: Skill[];
  onUpdateSkill: (
    skillId: string,
    field: "level" | "requirement" | "numQuestions" | "difficulty" | "priority",
    value: string | number
  ) => Promise<void>;
  getSkillQuestionCount: (skillId: string) => number;
  onDeleteSkill: (skillId: string) => void;
  loading: boolean;
}

export default function SkillsTable({
  skills,
  onUpdateSkill,
  getSkillQuestionCount,
  onDeleteSkill,
  loading,
}: SkillsTableProps) {
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
      default:
        return level;
    }
  };

  // Define columns
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Skill Name",
        cell: (info) => (
          <div className="max-w-full overflow-hidden break-words font-medium">
            {info.getValue()}
          </div>
        ),
        size: 150,
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
              className="w-full"
              aria-label={`Select level for ${info.row.original.name}`}
            >
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent
              className="w-[160px]"
              position="popper"
              sideOffset={5}
            >
              <SelectItem value="BEGINNER">Beginner</SelectItem>
              <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
              <SelectItem value="PROFESSIONAL">Professional</SelectItem>
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
            onValueChange={(value) =>
              onUpdateSkill(info.row.original.id, "requirement", value)
            }
            disabled={loading}
          >
            <SelectTrigger
              className="w-full"
              aria-label={`Select requirement for ${info.row.original.name}`}
            >
              <SelectValue placeholder="Requirement" />
            </SelectTrigger>
            <SelectContent
              className="w-[160px]"
              position="popper"
              sideOffset={5}
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
        cell: (info) => (
          <Select
            defaultValue={String(info.getValue())}
            onValueChange={(value) =>
              onUpdateSkill(
                info.row.original.id,
                "numQuestions",
                parseInt(value)
              )
            }
            disabled={loading}
          >
            <SelectTrigger
              className="w-full"
              aria-label={`Select number of questions for ${info.row.original.name}`}
            >
              <SelectValue placeholder="Count" />
            </SelectTrigger>
            <SelectContent
              className="w-[160px]"
              position="popper"
              sideOffset={5}
            >
              {[1, 2, 3, 4, 5].map((num) => (
                <SelectItem key={num} value={String(num)}>
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
        size: 100,
      }),
      columnHelper.accessor("difficulty", {
        header: "Difficulty",
        cell: (info) => (
          <Select
            value={info.getValue() || "Medium"}
            onValueChange={(value) =>
              onUpdateSkill(info.row.original.id, "difficulty", value)
            }
            disabled={loading}
          >
            <SelectTrigger
              className="w-full"
              aria-label={`Select difficulty for ${info.row.original.name}`}
            >
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent
              className="w-[160px]"
              position="popper"
              sideOffset={5}
            >
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        ),
        size: 100,
      }),
      columnHelper.accessor((row) => row.id, {
        id: "actions",
        header: "Actions",
        cell: (info) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeleteSkill(info.getValue())}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ),
        size: 80,
      }),
    ],
    [columnHelper, getSkillQuestionCount, loading, onDeleteSkill, onUpdateSkill]
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
  );
}
