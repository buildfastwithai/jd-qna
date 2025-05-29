import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get all skill records with related data
    const skillRecords = await prisma.skillRecord.findMany({
      include: {
        skills: {
          include: {
            questions: true,
            feedbacks: true,
          },
        },
        questions: true,
        globalFeedback: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate statistics
    const totalRecords = skillRecords.length;
    const totalSkills = await prisma.skill.count();
    const totalQuestions = await prisma.question.count();
    const totalFeedbacks = await prisma.feedback.count();

    // Question like statistics
    const likedQuestions = await prisma.question.count({
      where: { liked: "LIKED" },
    });
    const dislikedQuestions = await prisma.question.count({
      where: { liked: "DISLIKED" },
    });
    const neutralQuestions = await prisma.question.count({
      where: { liked: "NONE" },
    });

    // Skill level distribution
    const skillLevelStats = await prisma.skill.groupBy({
      by: ["level"],
      _count: {
        id: true,
      },
    });

    // Skill category distribution
    const skillCategoryStats = await prisma.skill.groupBy({
      by: ["category"],
      _count: {
        id: true,
      },
    });

    // Recent activity
    const recentRecords = await prisma.skillRecord.findMany({
      take: 5,
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        skills: {
          select: {
            name: true,
            level: true,
            category: true,
          },
        },
        _count: {
          select: {
            questions: true,
          },
        },
      },
    });

    const dashboardData = {
      skillRecords,
      statistics: {
        totalRecords,
        totalSkills,
        totalQuestions,
        totalFeedbacks,
        questionLikes: {
          liked: likedQuestions,
          disliked: dislikedQuestions,
          neutral: neutralQuestions,
        },
        skillLevelDistribution: skillLevelStats.map((stat) => ({
          level: stat.level,
          count: stat._count.id,
        })),
        skillCategoryDistribution: skillCategoryStats.map((stat) => ({
          category: stat.category,
          count: stat._count.id,
        })),
      },
      recentActivity: recentRecords,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
