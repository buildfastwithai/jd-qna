import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { feedback, floCareerId, floCareerPoolId } = body;

    // Validate inputs
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Question ID is required" },
        { status: 400 }
      );
    }

    if (feedback === undefined && floCareerId === undefined && floCareerPoolId === undefined) {
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
      floCareerPoolId?: number;
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

    if (floCareerPoolId !== undefined) {
      // Validate floCareerPoolId
      const floCareerPoolIdValue = Number(floCareerPoolId);
      if (isNaN(floCareerPoolIdValue) || floCareerPoolIdValue < 1) {
        return NextResponse.json(
          { success: false, error: "floCareerPoolId must be a positive number" },
          { status: 400 }
        );
      }
      updateData.floCareerPoolId = floCareerPoolIdValue;
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
    const body = await request.json();
    const { deletedFeedback } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Question ID is required" },
        { status: 400 }
      );
    }

    // Soft delete the question by setting deleted flag and storing feedback
    const updatedQuestion = await prisma.question.update({
      where: { id },
      data: {
        deleted: true,
        deletedFeedback: deletedFeedback || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Question deleted successfully",
      question: updatedQuestion,
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
