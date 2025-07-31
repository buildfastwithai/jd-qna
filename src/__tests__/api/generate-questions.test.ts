import { POST } from "@/app/api/generate-questions/route";
import { NextRequest } from "next/server";
import {
  mockPrisma,
  resetMocks,
  createMockSkillRecord,
  createMockSkill,
} from "../utils/api-test-utils";

// Mock AI module
jest.mock("@/lib/ai", () => ({
  generateQuestionsFromJD: jest.fn(),
}));

describe("/api/generate-questions", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  it("should generate questions successfully", async () => {
    const mockSkillRecord = createMockSkillRecord();
    const mockSkills = [
      createMockSkill({ name: "JavaScript" }),
      createMockSkill({ name: "React" }),
    ];

    // Mock AI response
    const { generateQuestionsFromJD } = require("@/lib/ai");
    generateQuestionsFromJD.mockResolvedValue({
      skillRecordId: mockSkillRecord.id,
      skills: mockSkills,
      questions: [
        {
          question: "What is JavaScript?",
          answer: "Programming language",
          category: "Technical",
          difficulty: "Medium",
          skillId: mockSkills[0].id,
        },
      ],
    });

    // Mock Prisma responses
    mockPrisma.skillRecord.create.mockResolvedValue(mockSkillRecord);
    mockPrisma.skill.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.question.createMany.mockResolvedValue({ count: 1 });

    const requestBody = {
      jobTitle: "Software Developer",
      jobDescription: "We are looking for a developer...",
      interviewLength: 60,
    };

    const request = new NextRequest(
      "http://localhost:3000/api/generate-questions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.skillRecordId).toBe(mockSkillRecord.id);
    expect(data.skills).toHaveLength(2);
    expect(data.questions).toHaveLength(1);
  });

  it("should handle missing required fields", async () => {
    const requestBody = {
      jobTitle: "",
      jobDescription: "",
    };

    const request = new NextRequest(
      "http://localhost:3000/api/generate-questions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("required");
  });

  it("should handle invalid interview length", async () => {
    const requestBody = {
      jobTitle: "Developer",
      jobDescription: "Job description",
      interviewLength: -10,
    };

    const request = new NextRequest(
      "http://localhost:3000/api/generate-questions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Interview length");
  });

  it("should handle AI generation errors", async () => {
    const { generateQuestionsFromJD } = require("@/lib/ai");
    generateQuestionsFromJD.mockRejectedValue(
      new Error("AI service unavailable")
    );

    const requestBody = {
      jobTitle: "Software Developer",
      jobDescription: "We are looking for a developer...",
      interviewLength: 60,
    };

    const request = new NextRequest(
      "http://localhost:3000/api/generate-questions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to generate questions");
  });

  it("should handle database errors", async () => {
    const { generateQuestionsFromJD } = require("@/lib/ai");
    generateQuestionsFromJD.mockResolvedValue({
      skillRecordId: "test-id",
      skills: [],
      questions: [],
    });

    // Mock database error
    mockPrisma.skillRecord.create.mockRejectedValue(
      new Error("Database error")
    );

    const requestBody = {
      jobTitle: "Software Developer",
      jobDescription: "We are looking for a developer...",
      interviewLength: 60,
    };

    const request = new NextRequest(
      "http://localhost:3000/api/generate-questions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to save generated data");
  });

  it("should validate job description length", async () => {
    const shortDescription = "Too short";
    const longDescription = "x".repeat(10001); // Too long

    for (const description of [shortDescription, longDescription]) {
      const requestBody = {
        jobTitle: "Developer",
        jobDescription: description,
        interviewLength: 60,
      };

      const request = new NextRequest(
        "http://localhost:3000/api/generate-questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    }
  });

  it("should handle different interview lengths", async () => {
    const validLengths = [30, 45, 60, 90, 120];

    for (const length of validLengths) {
      const { generateQuestionsFromJD } = require("@/lib/ai");
      generateQuestionsFromJD.mockResolvedValue({
        skillRecordId: "test-id",
        skills: [],
        questions: [],
      });

      mockPrisma.skillRecord.create.mockResolvedValue(createMockSkillRecord());

      const requestBody = {
        jobTitle: "Developer",
        jobDescription: "Job description",
        interviewLength: length,
      };

      const request = new NextRequest(
        "http://localhost:3000/api/generate-questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    }
  });

  it("should handle malformed JSON", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/generate-questions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid JSON");
  });
});
