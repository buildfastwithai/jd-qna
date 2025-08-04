import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reqId = searchParams.get("req_id");
    const userId = searchParams.get("user_id");

    if (!reqId || !userId) {
      return NextResponse.json(
        { success: false, error: "Both req_id and user_id are required" },
        { status: 400 }
      );
    }

    // Find record by reqId and userId
    const record = await prisma.skillRecord.findFirst({
      where: {
        reqId: parseInt(reqId),
        userId: parseInt(userId),
      },
      include: {
        skills: { orderBy: { priority: "asc" } },
        questions: { include: { skill: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (error: any) {
    console.error("Error finding record:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to find record" },
      { status: 500 }
    );
  }
}
