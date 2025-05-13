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

    const { level, requirement } = body;

    // Validate inputs
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Skill ID is required" },
        { status: 400 }
      );
    }

    if (!level && !requirement) {
      return NextResponse.json(
        {
          success: false,
          error: "Either level or requirement must be provided",
        },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: { level?: SkillLevel; requirement?: Requirement } = {};

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
