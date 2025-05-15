import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SkillLevel, Requirement } from "@prisma/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { level, requirement, numQuestions, difficulty } = body;

    // Validate inputs
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Skill ID is required" },
        { status: 400 }
      );
    }

    if (!level && !requirement && numQuestions === undefined && !difficulty) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one field must be provided to update",
        },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: {
      level?: SkillLevel;
      requirement?: Requirement;
      numQuestions?: number;
      difficulty?: string;
    } = {};

    if (level) {
      // Validate level
      if (!Object.values(SkillLevel).includes(level as SkillLevel)) {
        return NextResponse.json(
          { success: false, error: "Invalid skill level" },
          { status: 400 }
        );
      }
      updateData.level = level as SkillLevel;
    }

    if (requirement) {
      // Validate requirement
      if (!Object.values(Requirement).includes(requirement as Requirement)) {
        return NextResponse.json(
          { success: false, error: "Invalid requirement value" },
          { status: 400 }
        );
      }
      updateData.requirement = requirement as Requirement;
    }

    if (numQuestions !== undefined) {
      // Validate numQuestions
      const numQuestionsValue = Number(numQuestions);
      if (isNaN(numQuestionsValue) || numQuestionsValue < 1) {
        return NextResponse.json(
          { success: false, error: "Number of questions must be at least 1" },
          { status: 400 }
        );
      }
      updateData.numQuestions = numQuestionsValue;
    }

    if (difficulty) {
      // Validate difficulty
      const validDifficulties = ["Easy", "Medium", "Hard"];
      if (!validDifficulties.includes(difficulty)) {
        return NextResponse.json(
          { success: false, error: "Invalid difficulty value" },
          { status: 400 }
        );
      }
      updateData.difficulty = difficulty;
    }

    // Update skill
    const updatedSkill = await prisma.skill.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      skill: updatedSkill,
    });
  } catch (error: any) {
    console.error("Error updating skill:", error);

    // Check for Prisma errors
    if (error.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Skill not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || "Failed to update skill" },
      { status: 500 }
    );
  }
}
