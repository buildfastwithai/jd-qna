import { GET } from "@/app/api/excel-questions/[id]/route";
import { mockPrisma, resetMocks } from "../../utils/api-test-utils";
import "../../mocks/prisma";

describe("/api/excel-questions/[id]", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("GET", () => {
    it("should return excel question set successfully", async () => {
      const questionSetId = "excel-set-1";
      const mockExcelQuestionSet = {
        id: questionSetId,
        jobTitle: "Frontend Developer",
        experienceRange: "2-5 years",
        totalQuestions: 10,
        skillsExtracted: ["JavaScript", "React", "CSS"],
        rawJobDescription: "Frontend developer job description",
        createdAt: new Date(),
        updatedAt: new Date(),
        questions: [
          {
            slNo: 1,
            skill: "JavaScript",
            questionTitle: "Explain closures",
            questionDescription: "What are closures in JavaScript?",
            idealAnswer:
              "Closures are functions that have access to outer variables",
          },
          {
            slNo: 2,
            skill: "React",
            questionTitle: "React Hooks",
            questionDescription: "Explain useState hook",
            idealAnswer: "useState is a hook for managing component state",
          },
        ],
        record: {
          id: "record-1",
          jobTitle: "Frontend Developer",
        },
      };

      mockPrisma.excelQuestionSet.findUnique.mockResolvedValue(
        mockExcelQuestionSet
      );

      const request = new Request(
        `http://localhost:3000/api/excel-questions/${questionSetId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: questionSetId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(questionSetId);
      expect(data.data.jobTitle).toBe("Frontend Developer");
      expect(data.data.questions).toHaveLength(2);
      expect(data.data.questions[0].slNo).toBe(1);
      expect(data.data.questions[1].slNo).toBe(2);

      expect(mockPrisma.excelQuestionSet.findUnique).toHaveBeenCalledWith({
        where: { id: questionSetId },
        include: {
          questions: {
            orderBy: {
              slNo: "asc",
            },
          },
          record: true,
        },
      });
    });

    it("should return 400 when ID is missing", async () => {
      const request = new Request("http://localhost:3000/api/excel-questions/");
      const response = await GET(request, {
        params: Promise.resolve({ id: "" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Excel question set ID is required");
    });

    it("should return 404 when excel question set is not found", async () => {
      const questionSetId = "non-existent-set";
      mockPrisma.excelQuestionSet.findUnique.mockResolvedValue(null);

      const request = new Request(
        `http://localhost:3000/api/excel-questions/${questionSetId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: questionSetId }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Excel question set not found");
    });

    it("should handle database errors", async () => {
      const questionSetId = "excel-set-1";
      mockPrisma.excelQuestionSet.findUnique.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = new Request(
        `http://localhost:3000/api/excel-questions/${questionSetId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: questionSetId }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Database connection failed");
    });

    it("should order questions by slNo ascending", async () => {
      const questionSetId = "excel-set-1";
      mockPrisma.excelQuestionSet.findUnique.mockResolvedValue(null);

      const request = new Request(
        `http://localhost:3000/api/excel-questions/${questionSetId}`
      );
      await GET(request, { params: Promise.resolve({ id: questionSetId }) });

      const callArgs = mockPrisma.excelQuestionSet.findUnique.mock.calls[0][0];
      expect(callArgs.include.questions.orderBy).toEqual({
        slNo: "asc",
      });
    });

    it("should return questions in correct format", async () => {
      const questionSetId = "excel-set-1";
      const mockExcelQuestionSet = {
        id: questionSetId,
        jobTitle: "Test Job",
        experienceRange: "1-3 years",
        totalQuestions: 1,
        skillsExtracted: ["Test"],
        rawJobDescription: "Test description",
        createdAt: new Date(),
        updatedAt: new Date(),
        questions: [
          {
            slNo: 1,
            skill: "Test Skill",
            questionTitle: "Test Question",
            questionDescription: "Test Description",
            idealAnswer: "Test Answer",
          },
        ],
        record: null,
      };

      mockPrisma.excelQuestionSet.findUnique.mockResolvedValue(
        mockExcelQuestionSet
      );

      const request = new Request(
        `http://localhost:3000/api/excel-questions/${questionSetId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: questionSetId }),
      });
      const data = await response.json();

      expect(data.data.questions[0]).toEqual({
        slNo: 1,
        skill: "Test Skill",
        questionTitle: "Test Question",
        questionDescription: "Test Description",
        idealAnswer: "Test Answer",
      });
    });
  });
});
