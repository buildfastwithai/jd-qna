import { GET } from "@/app/api/dashboard/route";
import {
  mockPrisma,
  resetMocks,
  createMockSkillRecord,
  createMockSkill,
  createMockQuestion,
} from "../utils/api-test-utils";
import "../mocks/prisma";

describe("/api/dashboard", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("GET", () => {
    it("should return dashboard data successfully", async () => {
      // Mock data
      const mockSkillRecords = [
        {
          ...createMockSkillRecord(),
          skills: [
            {
              ...createMockSkill(),
              questions: [createMockQuestion()],
              feedbacks: [],
            },
          ],
          questions: [createMockQuestion()],
          globalFeedback: [],
        },
      ];

      // Setup mocks
      mockPrisma.skillRecord.findMany.mockResolvedValue(mockSkillRecords);
      mockPrisma.skill.count.mockResolvedValue(5);
      mockPrisma.question.count.mockResolvedValue(10);
      mockPrisma.feedback.count.mockResolvedValue(3);
      mockPrisma.regeneration.count.mockResolvedValue(2);

      // Mock question like statistics
      mockPrisma.question.count
        .mockResolvedValueOnce(4) // liked questions
        .mockResolvedValueOnce(2) // disliked questions
        .mockResolvedValueOnce(4); // neutral questions

      // Mock regeneration statistics
      mockPrisma.regeneration.groupBy.mockResolvedValue([
        { skillId: "skill-1", _count: { id: 5 } },
        { skillId: "skill-2", _count: { id: 3 } },
      ]);

      mockPrisma.skill.findMany.mockResolvedValue([
        { id: "skill-1", name: "JavaScript" },
        { id: "skill-2", name: "React" },
      ]);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.skillRecords).toEqual(mockSkillRecords);
      expect(data.statistics).toBeDefined();
      expect(data.statistics.totalRecords).toBe(1);
      expect(data.statistics.totalSkills).toBe(5);
      expect(data.statistics.totalQuestions).toBe(10);
      expect(data.statistics.totalFeedbacks).toBe(3);
      expect(data.statistics.totalRegenerations).toBe(2);
      expect(data.statistics.questionLikes.liked).toBe(4);
      expect(data.statistics.questionLikes.disliked).toBe(2);
      expect(data.statistics.questionLikes.neutral).toBe(4);
      expect(
        data.statistics.regenerationStats.mostRegeneratedSkills
      ).toHaveLength(2);
    });

    it("should handle empty data gracefully", async () => {
      // Setup mocks for empty data
      mockPrisma.skillRecord.findMany.mockResolvedValue([]);
      mockPrisma.skill.count.mockResolvedValue(0);
      mockPrisma.question.count.mockResolvedValue(0);
      mockPrisma.feedback.count.mockResolvedValue(0);
      mockPrisma.regeneration.count.mockResolvedValue(0);
      mockPrisma.regeneration.groupBy.mockResolvedValue([]);
      mockPrisma.skill.findMany.mockResolvedValue([]);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.skillRecords).toEqual([]);
      expect(data.statistics.totalRecords).toBe(0);
      expect(
        data.statistics.regenerationStats.averageRegenerationsPerQuestion
      ).toBe(0);
    });

    it("should handle database errors", async () => {
      // Setup mock to throw error
      mockPrisma.skillRecord.findMany.mockRejectedValue(
        new Error("Database connection failed")
      );

      // Execute
      const response = await GET();
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch dashboard data");
    });

    it("should order skill records by createdAt desc", async () => {
      mockPrisma.skillRecord.findMany.mockResolvedValue([]);
      mockPrisma.skill.count.mockResolvedValue(0);
      mockPrisma.question.count.mockResolvedValue(0);
      mockPrisma.feedback.count.mockResolvedValue(0);
      mockPrisma.regeneration.count.mockResolvedValue(0);
      mockPrisma.regeneration.groupBy.mockResolvedValue([]);
      mockPrisma.skill.findMany.mockResolvedValue([]);

      await GET();

      expect(mockPrisma.skillRecord.findMany).toHaveBeenCalledWith({
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
    });

    it("should calculate regeneration statistics correctly", async () => {
      mockPrisma.skillRecord.findMany.mockResolvedValue([]);
      mockPrisma.skill.count.mockResolvedValue(0);
      mockPrisma.question.count.mockResolvedValue(0);
      mockPrisma.feedback.count.mockResolvedValue(0);
      mockPrisma.regeneration.count.mockResolvedValue(0);
      mockPrisma.regeneration.groupBy.mockResolvedValue([
        { skillId: "skill-1", _count: { id: 5 } },
      ]);
      mockPrisma.skill.findMany.mockResolvedValue([
        { id: "skill-1", name: "JavaScript" },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(data.statistics.regenerationStats.mostRegeneratedSkills).toEqual([
        { skillName: "JavaScript", regenerationCount: 5 },
      ]);
    });
  });
});
