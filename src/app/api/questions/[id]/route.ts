import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { feedback, floCareerId } = body;

    // Validate inputs
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Question ID is required" },
        { status: 400 }
      );
    }

    if (feedback === undefined && floCareerId === undefined) {
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
      feedback?: string;
      floCareerId?: number;
    } = {};

    if (feedback !== undefined) {
      updateData.feedback = feedback;
    }

    if (floCareerId !== undefined) {
      // Validate floCareerId
      const floCareerIdValue = Number(floCareerId);
      if (isNaN(floCareerIdValue) || floCareerIdValue < 1) {
        return NextResponse.json(
          { success: false, error: "floCareerId must be a positive number" },
          { status: 400 }
        );
      }
      updateData.floCareerId = floCareerIdValue;
    }

    // Update question
    const updatedQuestion = await prisma.question.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      question: updatedQuestion,
    });
  } catch (error: any) {
    console.error("Error updating question:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update question",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Question ID is required" },
        { status: 400 }
      );
    }

    // Delete the question
    await prisma.question.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting question:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete question",
      },
      { status: 500 }
    );
  }
}
